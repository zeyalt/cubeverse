import type { SupabaseClient } from "@supabase/supabase-js";
import { DNF } from "./cubing";

export type RecordType = "single" | "average";
export type PbContext = "practice" | "official" | "overall";

export interface PbInput {
  ownerId: string;
  cuberId: string;
  eventId: string;
  recordType: RecordType;
  context: PbContext;
  timeCs: number;            // effective time; -1 (DNF) is never a PB
  solveId?: string | null;
  resultId?: string | null;
  competitionId?: string | null;
  achievedAt?: string;       // ISO date; defaults to now
}

/** Returns the current best time for (cuber, event, recordType, context). */
export async function getCurrentPb(
  db: SupabaseClient,
  cuberId: string,
  eventId: string,
  recordType: RecordType,
  context: PbContext
): Promise<number | null> {
  const { data } = await db
    .from("pb_history")
    .select("time_cs")
    .eq("cuber_id", cuberId)
    .eq("event_id", eventId)
    .eq("record_type", recordType)
    .eq("context", context)
    .gt("time_cs", 0) // exclude DNF rows
    .order("time_cs", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.time_cs ?? null;
}

/**
 * Compare timeCs to the current PB.
 * If it's a new PB: insert a pb_history row, update 'overall' context if needed.
 * Returns true if a new PB was set.
 *
 * DNF (-1) is never a PB and will immediately return false.
 */
export async function checkAndRecordPb(
  db: SupabaseClient,
  input: PbInput
): Promise<boolean> {
  const {
    ownerId, cuberId, eventId, recordType, context, timeCs,
    solveId, resultId, competitionId, achievedAt,
  } = input;

  if (timeCs <= DNF) return false; // DNF is never a PB

  const currentPb = await getCurrentPb(db, cuberId, eventId, recordType, context);
  if (currentPb !== null && timeCs >= currentPb) return false;

  const ts = achievedAt ?? new Date().toISOString();
  const row = {
    owner_id: ownerId,
    cuber_id: cuberId,
    event_id: eventId,
    record_type: recordType,
    time_cs: timeCs,
    solve_id: solveId ?? null,
    result_id: resultId ?? null,
    competition_id: competitionId ?? null,
    achieved_at: ts,
  };

  await db.from("pb_history").insert({ ...row, context });

  // Mirror to 'overall' context if this beats it too
  if (context !== "overall") {
    const overallPb = await getCurrentPb(db, cuberId, eventId, recordType, "overall");
    if (overallPb === null || timeCs < overallPb) {
      await db.from("pb_history").insert({ ...row, context: "overall" });
    }
  }

  return true;
}
