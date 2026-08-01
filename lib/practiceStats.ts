import { aoN, DNF } from "./cubing";

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
 * Current rolling average of the last `n` solves, per WCA rules.
 *
 * `effectiveTimes` must be oldest-first and already have penalties applied
 * (see `effectiveTime`), so a DNF is -1 and `aoN` can treat it as the worst
 * time in the window. Returns null when there aren't `n` solves yet, or when
 * the window resolves to a DNF.
 */
export function currentAoN(effectiveTimes: number[], n: number): number | null {
  if (effectiveTimes.length < n) return null;
  const result = aoN(effectiveTimes.slice(-n));
  return result === DNF ? null : result;
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
