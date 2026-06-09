"use server";

import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { parseToCs, effectiveTime, wcaAverage, DNF } from "@/lib/cubing";
import type { Penalty } from "@/lib/cubing";
import { redirect } from "next/navigation";

export type FormState = { error: string | null };

async function getDefaultCuberId(db: ReturnType<typeof getServiceClient>, ownerId: string) {
  const { data } = await db
    .from("app_settings")
    .select("default_cuber_id")
    .eq("owner_id", ownerId)
    .single();
  return data?.default_cuber_id as string | null;
}

// ─── Create unofficial competition ───────────────────────────────────────────

export async function createCompetition(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Competition name is required." };

  const db = getServiceClient();
  const ownerId = getOwnerId();
  const cuberId = await getDefaultCuberId(db, ownerId);
  if (!cuberId) return { error: "No cuber set up." };

  const { data: comp, error } = await db
    .from("competitions")
    .insert({
      owner_id: ownerId,
      cuber_id: cuberId,
      name,
      type: "unofficial",
      city: (formData.get("city") as string)?.trim() || null,
      country: (formData.get("country") as string)?.trim() || null,
      start_date: (formData.get("start_date") as string) || null,
      end_date: (formData.get("end_date") as string) || null,
      source: "manual",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  redirect(`/parent/competitions/${comp.id}`);
}

// ─── Add result (with individual solves) ─────────────────────────────────────

export async function addResult(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const competitionId = formData.get("competition_id") as string;
  const eventId = formData.get("event_id") as string;
  const roundType = (formData.get("round_type") as string) || "final";

  if (!competitionId || !eventId) return { error: "Missing required fields." };

  // Collect solves (1–5 slots)
  const rawSolves: { timeStr: string; penalty: Penalty }[] = [];
  for (let i = 1; i <= 5; i++) {
    const timeStr = (formData.get(`time_${i}`) as string | null)?.trim() ?? "";
    const penalty = ((formData.get(`penalty_${i}`) as string) || "none") as Penalty;
    // Include slot if it has a time OR a DNF/DNS penalty
    if (timeStr || penalty === "dnf" || penalty === "dns") {
      rawSolves.push({ timeStr, penalty });
    }
  }
  if (rawSolves.length === 0) return { error: "Enter at least one solve." };

  // Parse each solve
  const solves: { time_cs: number; penalty: Penalty }[] = [];
  for (const { timeStr, penalty } of rawSolves) {
    if (penalty === "dnf" || penalty === "dns") {
      solves.push({ time_cs: 0, penalty });
    } else {
      const cs = parseToCs(timeStr);
      if (!cs || cs <= 0) return { error: `"${timeStr}" is not a valid time. Use 12.34 or 1:23.45` };
      solves.push({ time_cs: cs, penalty });
    }
  }

  const db = getServiceClient();
  const ownerId = getOwnerId();

  const [cuberId, { data: event }] = await Promise.all([
    getDefaultCuberId(db, ownerId),
    db.from("events").select("format").eq("id", eventId).single(),
  ]);

  if (!cuberId) return { error: "No cuber set up." };
  if (!event) return { error: "Event not found." };

  // Compute effective times (with +2/DNF applied)
  const effTimes = solves.map((s) => effectiveTime(s.time_cs, s.penalty));

  // Best: min non-DNF, or -1 if all DNF
  const nonDnf = effTimes.filter((t) => t !== DNF);
  const best_cs = nonDnf.length > 0 ? Math.min(...nonDnf) : DNF;

  // Average: only if full round (ao5→5 solves, mo3→3 solves); else null (partial)
  let average_cs: number | null = null;
  if (
    (event.format === "ao5" && solves.length === 5) ||
    (event.format === "mo3" && solves.length === 3)
  ) {
    average_cs = wcaAverage(effTimes);
  }

  // Insert result row
  const { data: result, error: resultErr } = await db
    .from("results")
    .insert({
      owner_id: ownerId,
      cuber_id: cuberId,
      competition_id: competitionId,
      event_id: eventId,
      round_type: roundType,
      format: event.format,
      best_cs,
      average_cs,
      source: "manual",
    })
    .select("id")
    .single();

  if (resultErr) return { error: resultErr.message };

  // Insert individual solve rows
  const solveRows = solves.map((s, i) => ({
    owner_id: ownerId,
    cuber_id: cuberId,
    event_id: eventId,
    context: "competition",
    result_id: result.id,
    competition_id: competitionId,
    time_cs: s.time_cs,
    penalty: s.penalty,
    position: i + 1,
    source: "manual",
  }));

  const { error: solvesErr } = await db.from("solves").insert(solveRows);
  if (solvesErr) return { error: solvesErr.message };

  redirect(`/parent/competitions/${competitionId}`);
}

// ─── Delete competition (direct form action, no useActionState) ───────────────

export async function deleteCompetition(formData: FormData): Promise<void> {
  const id = formData.get("competition_id") as string;
  const db = getServiceClient();
  await db.from("competitions").delete().eq("id", id);
  redirect("/parent/competitions");
}

// ─── Delete result (direct form action, no useActionState) ───────────────────

export async function deleteResult(formData: FormData): Promise<void> {
  const resultId = formData.get("result_id") as string;
  const competitionId = formData.get("competition_id") as string;
  const db = getServiceClient();
  await db.from("results").delete().eq("id", resultId);
  redirect(`/parent/competitions/${competitionId}`);
}
