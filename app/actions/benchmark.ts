"use server";

import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import {
  fetchPersonResults,
  fetchCompetition,
  fetchPerson,
  mapRoundType,
  mapBest,
  mapAverage,
  type WcaApiResult,
} from "@/lib/wca";

// Same format used everywhere else a WCA ID is validated (app/actions/import.ts,
// app/onboarding/wca-id/page.tsx).
const WCA_ID_REGEX = /^\d{4}[A-Z]{4}\d{2}$/;

export interface SavedCompetitor {
  id: string;
  wcaId: string;
  name: string;
}

export interface BenchmarkPoint {
  ts: number;
  date: string;
  compName: string;
  bestCs: number;
  averageCs: number | null;
}

export interface BenchmarkPerson {
  wcaId: string;
  name: string;
  isMe: boolean;
  points: BenchmarkPoint[];
  error: string | null;
}

export interface BenchmarkSeriesResult {
  error: string | null;
  people: BenchmarkPerson[];
}

const ROUND_PRIORITY: Record<ReturnType<typeof mapRoundType>, number> = {
  first: 1,
  second: 2,
  semi: 3,
  final: 4,
};

/** Reduce a person's results (already filtered to one event) to their best
 *  (final-most) round per competition — mirrors how WCA itself summarises
 *  "your result" at an event as whichever round you last competed in. */
function bestRoundPerCompetition(results: WcaApiResult[]): Map<string, WcaApiResult> {
  const byComp = new Map<string, WcaApiResult>();
  for (const r of results) {
    const existing = byComp.get(r.competition_id);
    if (!existing || ROUND_PRIORITY[mapRoundType(r.round_type_id)] > ROUND_PRIORITY[mapRoundType(existing.round_type_id)]) {
      byComp.set(r.competition_id, r);
    }
  }
  return byComp;
}

export async function listBenchmarkCompetitors(cuberId: string): Promise<SavedCompetitor[]> {
  const db = getServiceClient();
  const { data } = await db
    .from("benchmark_competitors")
    .select("id, wca_id, name")
    .eq("cuber_id", cuberId)
    .order("created_at");

  return (data ?? []).map((r) => ({
    id: r.id as string,
    wcaId: r.wca_id as string,
    name: r.name as string,
  }));
}

export async function addBenchmarkCompetitor(
  cuberId: string,
  wcaIdRaw: string
): Promise<{ error: string | null; competitor: SavedCompetitor | null }> {
  const wcaId = wcaIdRaw.trim().toUpperCase();
  if (!wcaId) return { error: "Enter a WCA ID to add.", competitor: null };
  if (!WCA_ID_REGEX.test(wcaId)) {
    return { error: "Invalid WCA ID format (e.g. 2015DOEJ01).", competitor: null };
  }

  let name: string;
  try {
    name = (await fetchPerson(wcaId)).name;
  } catch (e) {
    return { error: (e as Error).message, competitor: null };
  }

  const db = getServiceClient();
  const ownerId = getOwnerId();
  const { data, error } = await db
    .from("benchmark_competitors")
    .upsert(
      { owner_id: ownerId, cuber_id: cuberId, wca_id: wcaId, name },
      { onConflict: "cuber_id,wca_id" }
    )
    .select("id, wca_id, name")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not save competitor.", competitor: null };

  return {
    error: null,
    competitor: { id: data.id as string, wcaId: data.wca_id as string, name: data.name as string },
  };
}

export async function removeBenchmarkCompetitor(id: string): Promise<{ error: string | null }> {
  const db = getServiceClient();
  const { error } = await db.from("benchmark_competitors").delete().eq("id", id);
  return { error: error?.message ?? null };
}

/**
 * Read-only "progress over time" comparison — fetches each person's results
 * live from the WCA API (no local persistence of results, only of the WCA
 * IDs themselves via addBenchmarkCompetitor) and returns each person's own
 * best-per-competition series for the given event, independent of whether
 * others attended the same competitions.
 */
export async function getBenchmarkSeries(
  myWcaId: string,
  otherWcaIds: string[],
  eventId: string
): Promise<BenchmarkSeriesResult> {
  if (!myWcaId) {
    return { error: "Set your own WCA ID in your profile first.", people: [] };
  }

  const uniqueOtherIds = [...new Set(otherWcaIds)].filter((id) => id !== myWcaId);

  const [mine, ...others] = await Promise.allSettled([
    fetchPersonResults(myWcaId),
    ...uniqueOtherIds.map((id) => fetchPersonResults(id)),
  ]);

  if (mine.status === "rejected") {
    return { error: (mine.reason as Error).message, people: [] };
  }

  const perPersonResults: { wcaId: string; isMe: boolean; results: WcaApiResult[]; error: string | null }[] = [
    { wcaId: myWcaId, isMe: true, results: mine.value.filter((r) => r.event_id === eventId), error: null },
    ...uniqueOtherIds.map((wcaId, i) => {
      const settled = others[i];
      return settled.status === "fulfilled"
        ? { wcaId, isMe: false, results: settled.value.filter((r) => r.event_id === eventId), error: null }
        : { wcaId, isMe: false, results: [], error: (settled.reason as Error).message };
    }),
  ];

  // Union of every competition any of these people attended (for this event),
  // fetched once and shared across all series.
  const allCompIds = new Set(perPersonResults.flatMap((p) => p.results.map((r) => r.competition_id)));
  const compDetails = new Map(
    (
      await Promise.all(
        [...allCompIds].map((id) => fetchCompetition(id).catch(() => null))
      )
    )
      .filter((c): c is Awaited<ReturnType<typeof fetchCompetition>> => c !== null)
      .map((c) => [c.id, c] as const)
  );

  // Names are cosmetic — a lookup failure shouldn't sink the comparison.
  const names = new Map<string, string>();
  await Promise.all(
    uniqueOtherIds.map(async (wcaId) => {
      names.set(wcaId, await fetchPerson(wcaId).then((p) => p.name).catch(() => wcaId));
    })
  );

  const people: BenchmarkPerson[] = perPersonResults.map(({ wcaId, isMe, results, error }) => {
    const byComp = bestRoundPerCompetition(results);
    const points: BenchmarkPoint[] = [...byComp.entries()]
      .map(([compId, r]) => {
        const comp = compDetails.get(compId);
        if (!comp || !comp.start_date) return null;
        return {
          ts: new Date(comp.start_date).getTime(),
          date: comp.start_date,
          compName: comp.name,
          bestCs: mapBest(r.best),
          averageCs: mapAverage(r.average),
        };
      })
      .filter((p): p is BenchmarkPoint => p !== null)
      .sort((a, b) => a.ts - b.ts);

    return {
      wcaId,
      name: isMe ? "You" : names.get(wcaId) ?? wcaId,
      isMe,
      points,
      error,
    };
  });

  return { error: null, people };
}
