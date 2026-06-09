import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrCreateSession } from "@/lib/session";

export interface ParsedSolve {
  event_id: string;
  time_cs: number;
  penalty: "none" | "plus2" | "dnf" | "dns";
  scramble?: string;
  solved_at?: string; // ISO date; defaults to now
  comment?: string;
}

/**
 * Shared ingest path used by both the in-app timer and future importers
 * (Twisty Timer, csTimer). Groups solves into sessions automatically.
 * Idempotent deduplication will be added when bulk importers are built (Phase 8b).
 *
 * Returns the IDs of the inserted solves.
 */
export async function ingestPracticeSolves(
  db: SupabaseClient,
  ownerId: string,
  cuberId: string,
  solves: ParsedSolve[],
  source: "manual" | "twisty_import" = "manual"
): Promise<string[]> {
  if (solves.length === 0) return [];

  const insertedIds: string[] = [];

  for (const solve of solves) {
    const sessionId = await getOrCreateSession(
      db,
      ownerId,
      cuberId,
      solve.event_id
    );

    const { count: existingCount } = await db
      .from("solves")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId);

    const position = (existingCount ?? 0) + 1;

    const { data, error } = await db
      .from("solves")
      .insert({
        owner_id: ownerId,
        cuber_id: cuberId,
        event_id: solve.event_id,
        context: "practice",
        session_id: sessionId,
        time_cs: solve.time_cs,
        penalty: solve.penalty,
        scramble: solve.scramble ?? null,
        comment: solve.comment ?? null,
        position,
        solved_at: solve.solved_at ?? new Date().toISOString(),
        source,
      })
      .select("id")
      .single();

    if (!error && data) insertedIds.push(data.id);
  }

  return insertedIds;
}
