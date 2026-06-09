"use server";

import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { ingestPracticeSolves } from "@/lib/import/ingest";
import { getOrCreateSession } from "@/lib/session";
import { effectiveTime, aoN, DNF } from "@/lib/cubing";
import type { Penalty } from "@/lib/cubing";
import { checkAndRecordPb } from "@/lib/pb";
import { checkAndUnlockBadges } from "@/lib/badges";

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
  isPb: boolean;         // true if this solve set a new practice single PB
  newBadges: string[];   // badge keys newly unlocked this solve
}

async function computeStats(
  db: ReturnType<typeof getServiceClient>,
  sessionId: string
): Promise<{ stats: Omit<SessionStats, "sessionId" | "isPb" | "newBadges">; solveIds: string[] }> {
  const { data: rows } = await db
    .from("solves")
    .select("id, time_cs, penalty")
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
    stats: {
      count,
      bestCs,
      ao5:  count >= 5  ? aoN(eff.slice(-5))  : null,
      ao12: count >= 12 ? aoN(eff.slice(-12)) : null,
    },
    solveIds: (rows ?? []).map((r) => r.id as string),
  };
}

export async function recordSolve(input: SolveInput): Promise<SessionStats> {
  const db = getServiceClient();
  const ownerId = getOwnerId();

  // Insert solve via shared ingest path
  const [solveId] = await ingestPracticeSolves(db, ownerId, input.cuberId, [
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

  const { stats, solveIds } = await computeStats(db, sessionId);

  // ── PB detection ──────────────────────────────────────────────────────────
  const effCs = effectiveTime(input.timeCs, input.penalty as Penalty);

  const isPbSingle = await checkAndRecordPb(db, {
    ownerId,
    cuberId: input.cuberId,
    eventId: input.eventId,
    recordType: "single",
    context: "practice",
    timeCs: effCs,
    solveId: solveId ?? null,
  });

  // Check average PB if we have enough solves (Ao5 for most events)
  let isPbAverage = false;
  if (stats.ao5 !== null && stats.ao5 > 0) {
    const latestSolveId = solveIds[solveIds.length - 1] ?? null;
    isPbAverage = await checkAndRecordPb(db, {
      ownerId,
      cuberId: input.cuberId,
      eventId: input.eventId,
      recordType: "average",
      context: "practice",
      timeCs: stats.ao5,
      solveId: latestSolveId,
    });
  }

  const isPb = isPbSingle || isPbAverage;

  // ── Badge check ───────────────────────────────────────────────────────────
  const newBadges: string[] = [];

  if (isPbSingle) {
    const unlocked = await checkAndUnlockBadges(
      db, ownerId, input.cuberId, input.eventId, "single", effCs
    );
    newBadges.push(...unlocked);
  }
  if (isPbAverage && stats.ao5 !== null && stats.ao5 > 0) {
    const unlocked = await checkAndUnlockBadges(
      db, ownerId, input.cuberId, input.eventId, "average", stats.ao5
    );
    newBadges.push(...unlocked);
  }

  return { sessionId, ...stats, isPb, newBadges };
}

export async function deleteSolve(solveId: string): Promise<void> {
  const db = getServiceClient();
  await db.from("solves").delete().eq("id", solveId);
}
