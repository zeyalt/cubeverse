/**
 * Session insights: where your solves' time goes, against where it should go.
 *
 * Works in the four phases cubers actually talk about — Cross, F2L, OLL, PLL — rather than the
 * seven steps the analysis produces. Four F2L pairs are interesting on a single solve (which pair
 * did you get stuck on?) but noise in an average, and the goal splits everyone quotes are per phase.
 *
 * Pure and DOM-free, like the analysis it reads.
 */

import { FLUENCY_PAUSE_MS, htmTurns, type SolveAnalysis, type StepName } from "./analysis";
import type { TimedMove } from "./moveStream";

export type Phase = "cross" | "f2l" | "oll" | "pll";
export const PHASES: readonly Phase[] = ["cross", "f2l", "oll", "pll"];

export const PHASE_LABEL: Record<Phase, string> = {
  cross: "Cross",
  f2l: "F2L",
  oll: "OLL",
  pll: "PLL",
};

const PHASE_OF: Record<StepName, Phase> = {
  cross: "cross",
  f2l1: "f2l",
  f2l2: "f2l",
  f2l3: "f2l",
  f2l4: "f2l",
  oll: "oll",
  pll: "pll",
};

/**
 * The share of a solve each phase should take, at any speed.
 *
 * These are the widely quoted CFOP proportions — a 30-second solve split 4 / 15.5 / 4.5 / 6 — and
 * they hold well across levels, which is what makes them useful as a target: an F2L at 60% of your
 * solve is a problem whether you average 20 seconds or 60.
 */
export const GOAL_SHARE: Record<Phase, number> = {
  cross: 4 / 30,
  f2l: 15.5 / 30,
  oll: 4.5 / 30,
  pll: 6 / 30,
};

/** Fewer solves than this and an average says more about luck than about the solver. */
export const MIN_SOLVES = 3;

/** Anything a solve needs for insights: its analysis and its timed moves. */
export interface InsightSolve {
  analysis: SolveAnalysis | null;
  moves: readonly TimedMove[];
}

export interface PhaseSplit {
  phase: Phase;
  ms: number;
  /** Fraction of the whole solve, 0–1. */
  share: number;
  recognitionMs: number;
  executionMs: number;
  /** HTM turns. */
  turns: number;
  /** Turns per second over the phase's whole time, thinking included. */
  tps: number;
}

export interface SplitSummary {
  phases: PhaseSplit[];
  totalMs: number;
  /** How many solves the average is built from. */
  count: number;
}

/**
 * Whether an analysis' numbers can be true.
 *
 * Every step has to fit inside the solve. This is not hypothetical: before the clock fix, a move
 * re-sent after a Bluetooth drop was timed on the browser's clock, and one stored solve has a
 * 20,751-second recognition time inside a 46-second solve. Averaging that in produced a step
 * "taking 16347% of your solve". Stored data can't be retroactively corrected, so it has to be
 * refused when read.
 */
export function isPlausible(analysis: SolveAnalysis | null): analysis is SolveAnalysis {
  if (!analysis || analysis.method !== "cfop" || analysis.steps.length === 0) return false;
  if (!Number.isFinite(analysis.totalMs) || analysis.totalMs <= 0) return false;
  let sum = 0;
  for (const step of analysis.steps) {
    if (!Number.isFinite(step.recognitionMs) || !Number.isFinite(step.executionMs)) return false;
    if (step.recognitionMs < 0 || step.executionMs < 0) return false;
    sum += step.recognitionMs + step.executionMs;
  }
  // The steps tile the solve, so they must add up to it. A little slack for millisecond rounding.
  return Math.abs(sum - analysis.totalMs) <= 50;
}

/** One solve, folded into four phases. Null when its analysis can't be trusted. */
export function phaseSplits(solve: InsightSolve): PhaseSplit[] | null {
  const { analysis, moves } = solve;
  if (!isPlausible(analysis)) return null;

  const acc = new Map<Phase, { ms: number; rec: number; exe: number; turns: number }>();
  for (const phase of PHASES) acc.set(phase, { ms: 0, rec: 0, exe: 0, turns: 0 });

  for (const step of analysis.steps) {
    const entry = acc.get(PHASE_OF[step.name])!;
    entry.rec += step.recognitionMs;
    entry.exe += step.executionMs;
    entry.ms += step.recognitionMs + step.executionMs;
    // HTM per step from the moves themselves, so solves saved before steps carried a turn count
    // still get one. Falls back to the raw count when the stream wasn't kept.
    entry.turns += moves.length
      ? htmTurns(moves.slice(step.startIndex, step.endIndex + 1))
      : step.moveCount;
  }

  // A skipped OLL or PLL is a phase that took no time. It stays in the list at zero, so averages
  // count the skip as the free time it was rather than leaving it out and inflating the phase.
  return PHASES.map((phase) => {
    const { ms, rec, exe, turns } = acc.get(phase)!;
    return {
      phase,
      ms,
      share: ms / analysis.totalMs,
      recognitionMs: rec,
      executionMs: exe,
      turns,
      tps: ms > 0 ? (turns / ms) * 1000 : 0,
    };
  });
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Average split across solves. Null below `MIN_SOLVES` trustworthy ones.
 *
 * Phase times are averaged first and shares derived from those, rather than averaging shares:
 * that way the shares always add up to 100% and match the times shown next to them.
 */
export function averageSplits(solves: readonly InsightSolve[]): SplitSummary | null {
  const perSolve = solves.map(phaseSplits).filter((s): s is PhaseSplit[] => s !== null);
  if (perSolve.length < MIN_SOLVES) return null;

  const phases = PHASES.map((phase, i) => {
    const entries = perSolve.map((s) => s[i]);
    const ms = mean(entries.map((e) => e.ms));
    const turns = mean(entries.map((e) => e.turns));
    return {
      phase,
      ms,
      share: 0,
      recognitionMs: mean(entries.map((e) => e.recognitionMs)),
      executionMs: mean(entries.map((e) => e.executionMs)),
      turns,
      tps: ms > 0 ? (turns / ms) * 1000 : 0,
    };
  });
  const totalMs = phases.reduce((sum, p) => sum + p.ms, 0);
  for (const p of phases) p.share = totalMs > 0 ? p.ms / totalMs : 0;
  return { phases, totalMs, count: perSolve.length };
}

/** The goal time, split by `GOAL_SHARE`. */
export function goalSplits(goalMs: number): Array<{ phase: Phase; ms: number; share: number }> {
  return PHASES.map((phase) => ({ phase, ms: goalMs * GOAL_SHARE[phase], share: GOAL_SHARE[phase] }));
}

/**
 * A goal worth chasing, when the solver hasn't set one: about 20% faster than now, rounded to a
 * whole second. Close enough to feel reachable, far enough to show where the gap is.
 */
export function defaultGoalMs(averageMs: number): number {
  return Math.max(5_000, Math.round((averageMs * 0.8) / 1000) * 1000);
}

/** A share has to be this far over its goal before it's worth a tip. */
const TIP_THRESHOLD = 0.03;

export interface SplitTip {
  tone: "good" | "focus";
  text: string;
}

/**
 * One sentence on what to practise.
 *
 * Judged on *shares*, not times. Against a goal faster than you, every phase is slower than its
 * target — that is what a goal is — so "you're slower everywhere" would be true and useless. A
 * share over its target says which phase is slow *relative to the rest of your solving*, which is
 * the thing practice can fix.
 */
export function splitTip(summary: SplitSummary): SplitTip {
  let worst: PhaseSplit | null = null;
  let worstOver = TIP_THRESHOLD;
  for (const p of summary.phases) {
    const over = p.share - GOAL_SHARE[p.phase];
    if (over > worstOver) {
      worst = p;
      worstOver = over;
    }
  }
  if (!worst) {
    return {
      tone: "good",
      text: "Your splits are balanced. To get faster now, speed up everywhere: turning and lookahead.",
    };
  }

  const label = PHASE_LABEL[worst.phase];
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const looking = worst.ms > 0 ? worst.recognitionMs / worst.ms : 0;
  const why =
    looking >= 0.4
      ? `${pct(looking)} of that is spent looking rather than turning, so work on recognising cases quickly.`
      : `Most of that is turning, so work on drilling the algorithms until they're fast.`;
  return {
    tone: "focus",
    text: `${label} takes ${pct(worst.share)} of your solve, against a target of ${pct(GOAL_SHARE[worst.phase])}. ${why}`,
  };
}

export interface TpsPoint {
  /** Seconds since the solve's first move. */
  t: number;
  tps: number;
  phase: Phase;
}

/**
 * How much turning speed is smoothed. Each turn is spread over a bell curve this wide (one standard
 * deviation), so the curve shows speed changing through a solve without one fast trigger reading as
 * a spike. Narrower is jumpier; wider blurs a short recognition pause into its neighbours.
 */
export const TPS_SMOOTHING_MS = 400;
const SAMPLE_MS = 100;

/**
 * Turning speed through one solve, in turns per second, sampled every 100 ms.
 *
 * A smooth estimate rather than a count over a sliding window: each turn contributes a small bell
 * curve whose area is one turn, and the curve is their sum. A hard window — "turns in the last
 * second" — jumps by a whole turn every time one enters or leaves it, which drew a staircase. This
 * has the same units, and the area under it still equals the number of turns.
 *
 * Half turns count once, by giving the second quarter of a same-face pair no weight: the cube
 * reports `R2` as two moves, and counting both would put a spike on every half turn.
 */
export function tpsSeries(solve: InsightSolve): TpsPoint[] {
  const { analysis, moves } = solve;
  if (!isPlausible(analysis) || moves.length < 2) return [];

  const phaseAt: Phase[] = new Array(moves.length).fill("cross");
  for (const step of analysis.steps) {
    for (let i = step.startIndex; i <= step.endIndex && i < moves.length; i++) {
      phaseAt[i] = PHASE_OF[step.name];
    }
  }
  const weight = moves.map((m, i) => (i > 0 && moves[i - 1].move[0] === m.move[0] ? 0 : 1));

  const sigma = TPS_SMOOTHING_MS;
  const reach = 3 * sigma; // beyond three standard deviations a turn contributes nothing visible
  // Normalised so each turn's curve integrates to 1 turn; ×1000 converts per-ms to per-second.
  const norm = 1000 / (sigma * Math.sqrt(2 * Math.PI));
  const end = moves[moves.length - 1].t;

  const points: TpsPoint[] = [];
  let first = 0; // first move that can still reach the current sample
  let latest = 0; // most recent move at or before the sample, for its phase
  for (let t = 0; t <= end; t += SAMPLE_MS) {
    while (first < moves.length && moves[first].t < t - reach) first++;
    while (latest + 1 < moves.length && moves[latest + 1].t <= t) latest++;
    let rate = 0;
    for (let i = first; i < moves.length && moves[i].t <= t + reach; i++) {
      if (!weight[i]) continue;
      const d = (t - moves[i].t) / sigma;
      rate += norm * Math.exp(-0.5 * d * d);
    }
    points.push({ t: t / 1000, tps: rate, phase: phaseAt[latest] });
  }
  return points;
}

/** Where each phase starts, in seconds, for the chart's boundary markers. */
export function phaseStarts(solve: InsightSolve): Array<{ phase: Phase; t: number }> {
  const { analysis } = solve;
  if (!isPlausible(analysis)) return [];
  const starts: Array<{ phase: Phase; t: number }> = [];
  let cursorMs = 0;
  let previous: Phase | null = null;
  for (const step of analysis.steps) {
    const phase = PHASE_OF[step.name];
    if (phase !== previous && phase !== "cross") {
      // The phase begins when the previous one ended, so its recognition pause sits inside it.
      starts.push({ phase, t: cursorMs / 1000 });
    }
    cursorMs += step.recognitionMs + step.executionMs;
    previous = phase;
  }
  return starts;
}

/** Re-exported so the UI can explain fluency without importing the analysis module. */
export { FLUENCY_PAUSE_MS };
