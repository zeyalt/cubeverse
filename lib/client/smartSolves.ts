/**
 * Supabase access for smart-cube solves.
 *
 * Deliberately a separate module from `actions.ts`, mirroring the separate table: nothing here
 * calls `record_practice_solve`, so a smart solve cannot set a personal best, earn a badge, move a
 * goal or appear in Analytics. That isolation is the point, and it is easier to keep true when the
 * two code paths don't share a file.
 */

import { requireUser } from "@/lib/supabase/auth";
import type { SolveAnalysis } from "@/lib/smartcube/analysis";

export interface SmartSolveInput {
  cuberId: string;
  eventId: string;
  timeCs: number;
  penalty: "none" | "plus2" | "dnf";
  scramble: string | null;
  moveStream: string | null;
  moveStreamVersion: number;
  reconstruction: SolveAnalysis | null;
  timingSource: "cube" | "local";
  confidence: "high" | "low";
  cubeName: string | null;
  solvedAt: string;
  idempotencyId: string;
}

export interface StoredSmartSolve extends Omit<SmartSolveInput, "cuberId" | "idempotencyId"> {
  id: string;
}

type Row = {
  id: string;
  event_id: string;
  time_cs: number;
  penalty: string;
  scramble: string | null;
  move_stream: string | null;
  move_stream_version: number;
  reconstruction: SolveAnalysis | null;
  timing_source: string;
  confidence: string;
  cube_name: string | null;
  solved_at: string;
};

const SELECT =
  "id, event_id, time_cs, penalty, scramble, move_stream, move_stream_version, reconstruction, timing_source, confidence, cube_name, solved_at";

const fromRow = (row: Row): StoredSmartSolve => ({
  id: row.id,
  eventId: row.event_id,
  timeCs: row.time_cs,
  penalty: row.penalty === "dnf" ? "dnf" : row.penalty === "plus2" ? "plus2" : "none",
  scramble: row.scramble,
  moveStream: row.move_stream,
  moveStreamVersion: row.move_stream_version,
  reconstruction: row.reconstruction,
  timingSource: row.timing_source === "local" ? "local" : "cube",
  confidence: row.confidence === "low" ? "low" : "high",
  cubeName: row.cube_name,
  solvedAt: row.solved_at,
});

/**
 * Insert one solve.
 *
 * Resolves with `{ error }` rather than throwing, matching `recordSolve`: the offline queue needs
 * to tell "the network is down, retry later" apart from "the server rejected this, stop trying",
 * and a thrown error gets redacted in production builds before it can say which.
 */
export async function recordSmartSolve(
  input: SmartSolveInput
): Promise<{ id: string | null; error: string | null }> {
  try {
    const { db, ownerId } = await requireUser();
    const { data, error } = await db
      .from("smart_solves")
      .upsert(
        {
          owner_id: ownerId,
          cuber_id: input.cuberId,
          event_id: input.eventId,
          time_cs: input.timeCs,
          penalty: input.penalty,
          scramble: input.scramble,
          move_stream: input.moveStream,
          move_stream_version: input.moveStreamVersion,
          reconstruction: input.reconstruction,
          timing_source: input.timingSource,
          confidence: input.confidence,
          cube_name: input.cubeName,
          solved_at: input.solvedAt,
          idempotency_key: input.idempotencyId,
        },
        { onConflict: "cuber_id,idempotency_key", ignoreDuplicates: false }
      )
      .select("id")
      .single();
    if (error) throw error;
    return { id: (data as { id: string }).id, error: null };
  } catch (cause) {
    return { id: null, error: cause instanceof Error ? cause.message : "Save failed" };
  }
}

export async function listSmartSolves(
  cuberId: string,
  eventId: string,
  limit = 200
): Promise<StoredSmartSolve[]> {
  const { db } = await requireUser();
  const { data, error } = await db
    .from("smart_solves")
    .select(SELECT)
    .eq("cuber_id", cuberId)
    .eq("event_id", eventId)
    .order("solved_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Row[]).map(fromRow);
}

/** Apply a +2 or a DNF after the fact. `timeCs` stays the raw time; the penalty is applied on read. */
export async function updateSmartSolvePenalty(
  id: string,
  penalty: "none" | "plus2" | "dnf"
): Promise<void> {
  const { db, ownerId } = await requireUser();
  const { error } = await db
    .from("smart_solves")
    .update({ penalty })
    .eq("id", id)
    .eq("owner_id", ownerId);
  if (error) throw error;
}

export async function deleteSmartSolve(id: string): Promise<void> {
  const { db, ownerId } = await requireUser();
  const { error } = await db.from("smart_solves").delete().eq("id", id).eq("owner_id", ownerId);
  if (error) throw error;
}
