"use server";

import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import {
  fetchPersonResults,
  fetchCompetition,
  mapRoundType,
  mapFormat,
  mapAttempt,
  mapAverage,
  mapBest,
  meaningfulAttempts,
} from "@/lib/wca";
import { checkAndRecordPb } from "@/lib/pb";
import { checkAndUnlockBadges } from "@/lib/badges";

export interface ImportState {
  error: string | null;
  compsImported?: number;
  resultsImported?: number;
}

export async function importWcaResults(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const wcaId = (formData.get("wca_id") as string)?.trim().toUpperCase();
  if (!wcaId) return { error: "WCA ID is required." };
  if (!/^\d{4}[A-Z]{4}\d{2}$/.test(wcaId)) {
    return { error: "Invalid WCA ID format (e.g. 2025ZEYA01)." };
  }

  const db = getServiceClient();
  const ownerId = getOwnerId();

  const { data: settings } = await db
    .from("app_settings")
    .select("default_cuber_id")
    .eq("owner_id", ownerId)
    .single();
  if (!settings) return { error: "No cuber set up." };
  const cuberId = settings.default_cuber_id as string;

  // ── 1. Fetch results ────────────────────────────────────────────────────────
  let apiResults: Awaited<ReturnType<typeof fetchPersonResults>>;
  try {
    apiResults = await fetchPersonResults(wcaId);
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!apiResults.length) {
    return { error: `No competition results found for ${wcaId}.` };
  }

  // ── 2. Fetch competition details (unique comp IDs, parallel) ─────────────────
  const uniqueCompIds = [...new Set(apiResults.map((r) => r.competition_id))];
  const compDetails = (
    await Promise.all(
      uniqueCompIds.map((id) => fetchCompetition(id).catch(() => null))
    )
  ).filter(Boolean) as Awaited<ReturnType<typeof fetchCompetition>>[];

  let compsImported = 0;
  let resultsImported = 0;

  for (const comp of compDetails) {
    // ── 3. Upsert competition (idempotent on cuber_id + wca_competition_id) ───
    const { data: savedComp, error: compErr } = await db
      .from("competitions")
      .upsert(
        {
          owner_id: ownerId,
          cuber_id: cuberId,
          name: comp.name,
          type: "wca",
          wca_competition_id: comp.id,
          city: comp.city,
          country: comp.country_iso2,
          start_date: comp.start_date,
          end_date: comp.end_date,
          source: "wca_import",
        },
        { onConflict: "cuber_id,wca_competition_id" }
      )
      .select("id")
      .single();

    if (compErr || !savedComp) continue;
    compsImported++;

    // ── 4. Process each result for this competition ───────────────────────────
    const compResults = apiResults.filter((r) => r.competition_id === comp.id);

    for (const result of compResults) {
      const roundType = mapRoundType(result.round_type_id);
      const format = mapFormat(result.format_id);

      // Check for existing result (idempotent)
      const { data: existing } = await db
        .from("results")
        .select("id")
        .eq("competition_id", savedComp.id)
        .eq("event_id", result.event_id)
        .eq("round_type", roundType)
        .maybeSingle();

      let savedResultId: string;

      if (existing) {
        // Update in place
        await db
          .from("results")
          .update({
            best_cs: mapBest(result.best),
            average_cs: mapAverage(result.average),
            ranking: result.pos,
          })
          .eq("id", existing.id);
        savedResultId = existing.id;
      } else {
        const { data: newResult, error: resultErr } = await db
          .from("results")
          .insert({
            owner_id: ownerId,
            cuber_id: cuberId,
            competition_id: savedComp.id,
            event_id: result.event_id,
            round_type: roundType,
            format,
            best_cs: mapBest(result.best),
            average_cs: mapAverage(result.average),
            ranking: result.pos,
            source: "wca_import",
          })
          .select("id")
          .single();

        if (resultErr || !newResult) continue;
        savedResultId = newResult.id;
        resultsImported++;
      }

      // ── 5. Insert individual solves (skip if already exist) ─────────────────
      const { count: existingCount } = await db
        .from("solves")
        .select("id", { count: "exact", head: true })
        .eq("result_id", savedResultId);

      if (existingCount && existingCount > 0) continue;

      const attempts = meaningfulAttempts(result.attempts);
      if (!attempts.length) continue;

      const solveRows = attempts.map((attempt, i) => {
        const { time_cs, penalty } = mapAttempt(attempt);
        return {
          owner_id: ownerId,
          cuber_id: cuberId,
          event_id: result.event_id,
          context: "competition",
          result_id: savedResultId,
          competition_id: savedComp.id,
          time_cs,
          penalty,
          position: i + 1,
          source: "wca_import",
        };
      });

      await db.from("solves").insert(solveRows);
    }
  }

  // ── Recompute official PBs ──────────────────────────────────────────────────
  // Iterate all imported results and update pb_history for context='official'.
  for (const result of apiResults) {
    const best = mapBest(result.best);
    const avg = mapAverage(result.average);
    const compDate = compDetails.find((c) => c.id === result.competition_id)?.start_date ?? undefined;

    if (best > 0) {
      await checkAndRecordPb(db, {
        ownerId, cuberId, eventId: result.event_id,
        recordType: "single", context: "official",
        timeCs: best, achievedAt: compDate,
      });
      await checkAndUnlockBadges(db, ownerId, cuberId, result.event_id, "single", best);
    }

    if (avg !== null && avg > 0) {
      await checkAndRecordPb(db, {
        ownerId, cuberId, eventId: result.event_id,
        recordType: "average", context: "official",
        timeCs: avg, achievedAt: compDate,
      });
      await checkAndUnlockBadges(db, ownerId, cuberId, result.event_id, "average", avg);
    }
  }

  return { error: null, compsImported, resultsImported };
}
