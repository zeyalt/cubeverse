import { aoN } from "./cubing";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The six practice metrics shown on both the Practice tab and the Analytics
 * PB table. These used to be computed independently in two places, which had
 * to be kept in sync by hand; deriving both from here makes that mechanical.
 */
export interface PracticeSummary {
  ao5: number | null;
  ao12: number | null;
  ao50: number | null;
  ao100: number | null;
  best: number | null;
  count: number;
}

export interface PracticeSummaryWithTail extends PracticeSummary {
  eventId: string;
  recentTimes: number[];
}

/**
 * Fetch current practice metrics without transferring the cuber's history.
 * PostgreSQL aggregates count/best and reads at most the newest 100–500 rows
 * per event for current rolling averages and the requested client tail.
 */
export async function getPracticeSummaries(
  db: SupabaseClient,
  ownerId: string,
  cuberId: string,
  eventIds: string[],
  tailLimit = 0
): Promise<PracticeSummaryWithTail[]> {
  if (eventIds.length === 0) return [];

  const { data, error } = await db.rpc("get_practice_summaries", {
    p_owner_id: ownerId,
    p_cuber_id: cuberId,
    p_event_ids: eventIds,
    p_tail_limit: tailLimit,
  });
  if (error) throw new Error(`Failed to load practice summaries: ${error.message}`);

  return ((data ?? []) as Array<{
    event_id: string;
    ao5: number | null;
    ao12: number | null;
    ao50: number | null;
    ao100: number | null;
    best: number | null;
    count: number | string;
    recent_times: number[] | null;
  }>).map((row) => ({
    eventId: row.event_id,
    ao5: row.ao5,
    ao12: row.ao12,
    ao50: row.ao50,
    ao100: row.ao100,
    best: row.best,
    count: Number(row.count),
    recentTimes: row.recent_times ?? [],
  }));
}

/**
 * Current rolling average of the last `n` solves.
 *
 * Ao5 follows WCA rules: drop best and worst, two DNFs make the average DNF.
 * Ao12 / Ao50 / Ao100 skip DNFs and average the last `n` successful solves
 * (still dropping best and worst among those).
 *
 * `effectiveTimes` must be oldest-first with penalties already applied.
 */
export function currentAoN(effectiveTimes: number[], n: number): number | null {
  if (n <= 5) {
    if (effectiveTimes.length < n) return null;
    return aoN(effectiveTimes.slice(-n));
  }
  const successful = effectiveTimes.filter((time) => time > 0);
  if (successful.length < n) return null;
  return aoN(successful.slice(-n));
}

/**
 * `best` is the fastest non-DNF time; `count` includes DNFs, since a DNF is
 * still an attempt.
 */
export function practiceSummary(effectiveTimes: number[]): PracticeSummary {
  const nonDnf = effectiveTimes.filter((t) => t > 0);
  return {
    ao5: currentAoN(effectiveTimes, 5),
    ao12: currentAoN(effectiveTimes, 12),
    ao50: currentAoN(effectiveTimes, 50),
    ao100: currentAoN(effectiveTimes, 100),
    best: nonDnf.length > 0 ? Math.min(...nonDnf) : null,
    count: effectiveTimes.length,
  };
}
