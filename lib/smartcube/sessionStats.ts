/**
 * The `NOW` / `BEST` stats table: single, ao5, ao12, ao50, ao100.
 *
 * `NOW` is the average ending at the most recent solve; `BEST` is the fastest such average seen
 * anywhere in the session. A row where the two are equal means the latest solve just set that
 * record, which is what the UI highlights.
 *
 * Averaging is delegated entirely to `lib/cubing.ts` and `lib/practiceStats.ts` — the same WCA
 * rules the Practice tab uses, so a smart-cube ao5 and a hand-timed ao5 can be compared without a
 * footnote. Nothing here touches stored PBs or badges; this is computed from the session's solves
 * on every render.
 */

import { DNF } from "../cubing";
import { currentAoN } from "../practiceStats";

/** The windows the table shows. `1` is the single. */
export const STAT_WINDOWS = [1, 5, 12, 50, 100] as const;
export type StatWindow = (typeof STAT_WINDOWS)[number];

export interface StatRow {
  n: StatWindow;
  label: string;
  /** Centiseconds, `DNF` (-1), or null when there aren't enough solves yet. */
  now: number | null;
  best: number | null;
  /** The latest solve set this record — render it as a PB. */
  isRecord: boolean;
}

const LABELS: Record<StatWindow, string> = {
  1: "single",
  5: "ao5",
  12: "ao12",
  50: "ao50",
  100: "ao100",
};

/**
 * Average of the last `n` solves of `times`, or the single when `n` is 1.
 *
 * Takes oldest-first effective times (penalties already applied, DNF as -1), the same convention
 * as `practiceSummary`.
 */
function windowValue(times: readonly number[], n: StatWindow): number | null {
  if (n === 1) return times.length ? times[times.length - 1] : null;
  return currentAoN([...times], n);
}

/**
 * Fastest value this window ever reached in the session.
 *
 * Computed by walking every prefix rather than with a sliding window: ao12 and above skip DNFs
 * before averaging, so the window's contents aren't a fixed slice of the array and an incremental
 * update would be wrong. Sessions are tens of solves, so the cost is irrelevant.
 */
function bestValue(times: readonly number[], n: StatWindow): number | null {
  let best: number | null = null;
  for (let end = n; end <= times.length; end++) {
    const value = windowValue(times.slice(0, end), n);
    // A DNF average is never a record, but it must not block a later real one either.
    if (value === null || value === DNF) continue;
    if (best === null || value < best) best = value;
  }
  return best;
}

/**
 * Build the whole table from a session's effective times, oldest first.
 *
 * `isRecord` is true only when the current value *is* the best one, which for a brand-new record
 * is exactly the condition the spec describes for the accent highlight.
 */
export function sessionStats(effectiveTimes: readonly number[]): StatRow[] {
  return STAT_WINDOWS.map((n) => {
    const now = windowValue(effectiveTimes, n);
    const best = bestValue(effectiveTimes, n);
    return {
      n,
      label: LABELS[n],
      now,
      best,
      isRecord: now !== null && now !== DNF && now === best,
    };
  });
}

/** Index of the fastest non-DNF solve, for highlighting it in the solve list. */
export function bestSingleIndex(effectiveTimes: readonly number[]): number | null {
  let bestIndex: number | null = null;
  effectiveTimes.forEach((time, i) => {
    if (time === DNF || time <= 0) return;
    if (bestIndex === null || time < effectiveTimes[bestIndex]) bestIndex = i;
  });
  return bestIndex;
}

/**
 * The value of one window after every solve, for the History chart: point `i` is the single, or
 * the average ending at solve `i`. Null where there weren't yet enough solves, and for a DNF
 * average — a gap in the line, rather than a spike to an arbitrary "DNF" height.
 */
export function rollingSeries(effectiveTimes: readonly number[], n: StatWindow): Array<number | null> {
  return effectiveTimes.map((_, i) => {
    const value = windowValue(effectiveTimes.slice(0, i + 1), n);
    return value === null || value === DNF ? null : value;
  });
}

/**
 * A solve's time as every average sees it: the +2 added, a DNF as `DNF`.
 *
 * One definition, because the stats table, the History chart and the solve list all need it, and
 * three copies of "add 200 for a +2" is how one of them ends up forgetting.
 */
export function effectiveCs(solve: { timeCs: number | null; penalty: "none" | "plus2" | "dnf" }): number {
  if (solve.penalty === "dnf" || solve.timeCs === null) return DNF;
  return solve.timeCs + (solve.penalty === "plus2" ? 200 : 0);
}
