"use server";

import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { ingestPracticeSolves } from "@/lib/import/ingest";
import { getOrCreateSession } from "@/lib/session";
import { effectiveTime, aoN, DNF } from "@/lib/cubing";
import type { Penalty } from "@/lib/cubing";
import { checkAndRecordPb } from "@/lib/pb";
import { checkAndUnlockBadges, checkActivityBadges } from "@/lib/badges";
import { checkAndAchieveGoals } from "@/lib/goals";
import { computeStreak } from "@/lib/streak";

export interface SolveInput {
  cuberId: string;
  eventId: string;
  timeCs: number;
  penalty: "none" | "plus2" | "dnf";
  scramble: string | null;
  cubeId?: string; // optional: which cube was used
}

export interface SessionStats {
  sessionId: string;
  solveId: string | null; // id of the just-recorded solve (for later edit/delete)
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
): Promise<{ stats: Omit<SessionStats, "sessionId" | "solveId" | "isPb" | "newBadges">; solveIds: string[] }> {
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
      ...(input.cubeId && { cube_id: input.cubeId }),
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
    await checkAndAchieveGoals(db, input.cuberId, input.eventId, "single", effCs);
  }
  if (isPbAverage && stats.ao5 !== null && stats.ao5 > 0) {
    const unlocked = await checkAndUnlockBadges(
      db, ownerId, input.cuberId, input.eventId, "average", stats.ao5
    );
    newBadges.push(...unlocked);
    await checkAndAchieveGoals(db, input.cuberId, input.eventId, "average", stats.ao5);
  }

  // Activity badges (count + streak)
  const [{ count: totalSolves }, streak] = await Promise.all([
    db.from("solves").select("id", { count: "exact", head: true })
      .eq("cuber_id", input.cuberId).eq("context", "practice"),
    computeStreak(db, input.cuberId),
  ]);
  const activityBadges = await checkActivityBadges(db, ownerId, input.cuberId, {
    solveCount: totalSolves ?? 0,
    streak,
    newPb: isPb,
  });
  newBadges.push(...activityBadges);

  return { sessionId, solveId: solveId ?? null, ...stats, isPb, newBadges };
}

export async function deleteSolve(solveId: string): Promise<void> {
  const db = getServiceClient();
  await db.from("solves").delete().eq("id", solveId);
}

export interface HistoricalSolve {
  id: string;
  cs: number;
  penalty: "none" | "plus2" | "dnf";
  timestamp: number;
  scramble: string | null;
}

export async function getHistoricalSolves(
  cuberId: string,
  eventId: string
): Promise<HistoricalSolve[]> {
  const db = getServiceClient();

  const { data: solves, error } = await db
    .from("solves")
    .select("id, time_cs, penalty, solved_at, scramble")
    .eq("cuber_id", cuberId)
    .eq("event_id", eventId)
    .eq("context", "practice")
    .order("solved_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Error fetching historical solves:", error);
    return [];
  }

  return (solves ?? []).map((s: {
    id: string;
    time_cs: number;
    penalty: string | null;
    solved_at: string;
    scramble: string | null;
  }) => ({
    id: s.id,
    cs: s.time_cs,
    penalty: s.penalty === "dnf" ? "dnf" : s.penalty === "plus2" ? "plus2" : "none",
    timestamp: new Date(s.solved_at).getTime(),
    scramble: s.scramble ?? null,
  }));
}

export async function updateSolve(
  solveId: string,
  timeCs: number,
  penalty: "none" | "plus2" | "dnf"
): Promise<void> {
  const db = getServiceClient();
  await db.from("solves").update({ time_cs: timeCs, penalty }).eq("id", solveId);
}
