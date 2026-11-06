import { aoN } from "./cubing";

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
