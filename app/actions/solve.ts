"use server";

import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { ingestPracticeSolves } from "@/lib/import/ingest";
import { getOrCreateSession } from "@/lib/session";
import { effectiveTime, aoN, DNF } from "@/lib/cubing";
import type { Penalty } from "@/lib/cubing";

export interface SolveInput {
  cuberId: string;
  eventId: string;
  timeCs: number;
  penalty: "none" | "plus2" | "dnf";
  scramble: string | null;
}

export interface SessionStats {
  sessionId: string;
  count: number;
  bestCs: number | null; // null = no solves; -1 = all DNF
  ao5: number | null;    // null = fewer than 5 solves
  ao12: number | null;   // null = fewer than 12 solves
}

async function computeStats(
  db: ReturnType<typeof getServiceClient>,
  sessionId: string
): Promise<Omit<SessionStats, "sessionId">> {
  const { data: rows } = await db
    .from("solves")
    .select("time_cs, penalty")
    .eq("session_id", sessionId)
    .order("solved_at", { ascending: true });

  const eff = (rows ?? []).map((r) =>
    effectiveTime(r.time_cs as number, r.penalty as Penalty)
  );

  const count = eff.length;
  const nonDnf = eff.filter((t) => t !== DNF);
  const bestCs =
    count === 0 ? null : nonDnf.length > 0 ? Math.min(...nonDnf) : DNF;

  return {
    count,
    bestCs,
    ao5:  count >= 5  ? aoN(eff.slice(-5))  : null,
    ao12: count >= 12 ? aoN(eff.slice(-12)) : null,
  };
}

export async function recordSolve(input: SolveInput): Promise<SessionStats> {
  const db = getServiceClient();
  const ownerId = getOwnerId();

  await ingestPracticeSolves(db, ownerId, input.cuberId, [
    {
      event_id: input.eventId,
      time_cs: input.timeCs,
      penalty: input.penalty,
      scramble: input.scramble ?? undefined,
    },
  ]);

  const sessionId = await getOrCreateSession(
    db,
    ownerId,
    input.cuberId,
    input.eventId
  );

  const stats = await computeStats(db, sessionId);
  return { sessionId, ...stats };
}

export async function deleteSolve(solveId: string): Promise<void> {
  const db = getServiceClient();
  await db.from("solves").delete().eq("id", solveId);
}
