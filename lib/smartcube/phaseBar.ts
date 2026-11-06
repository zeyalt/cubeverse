/**
 * Layout for the post-solve phase bar: one proportional pill covering the whole solve, split by
 * CFOP step, with the pauses inside each step drawn darker.
 *
 * Pure, and separate from the component, because the interesting part is not the drawing but the
 * label placement. The reference app's own bar overlaps its OLL and PLL numbers whenever those
 * segments are narrow — the spec calls that out as a flaw to avoid — and "avoid" means deciding,
 * from the real widths, which labels can be shown where. That is a geometry problem with a right
 * answer, so it gets tested rather than eyeballed.
 */

import { PAUSE_MS, type SolveAnalysis, type SolveStep } from "./analysis";
import type { TimedMove } from "./moveStream";

export interface PhaseSegment {
  name: string;
  label: string;
  /** Fractions of the whole solve, 0–1. */
  start: number;
  width: number;
  ms: number;
  /** Pauses within this segment, as fractions of the whole solve. */
  pauses: Array<{ start: number; width: number }>;
  /** Where this segment's time and name should be drawn. */
  labelPlacement: "above" | "legend";
}

export interface PhaseBarLayout {
  segments: PhaseSegment[];
  totalMs: number;
  /** Segments too narrow to label in place; render these as a legend row underneath. */
  legend: PhaseSegment[];
}

/**
 * A label needs roughly this share of the bar's width to sit under its own segment without
 * touching its neighbour. Below it, the label moves to the legend instead of being squeezed,
 * abbreviated, or allowed to overlap.
 *
 * 9% of a 340 px bar is ~30 px, about the width of "4.71" at the size the spec gives for these
 * labels. It is a share rather than a pixel count so the same layout holds on any screen.
 */
export const MIN_LABEL_FRACTION = 0.09;

/** Build the bar from an analysis and its move stream. Returns null when there's nothing to draw. */
export function phaseBarLayout(
  analysis: SolveAnalysis | null,
  moves: readonly TimedMove[]
): PhaseBarLayout | null {
  if (!analysis || analysis.steps.length === 0 || analysis.totalMs <= 0) return null;

  const total = analysis.totalMs;
  const t0 = moves.length ? moves[0].t : 0;
  // Start of the solve, in the same frame as `step` indices.
  let cursorMs = 0;

  const segments: PhaseSegment[] = analysis.steps.map((step) => {
    const ms = step.recognitionMs + step.executionMs;
    const segment: PhaseSegment = {
      name: step.name,
      label: step.label,
      start: cursorMs / total,
      width: ms / total,
      ms,
      pauses: pausesIn(step, moves, t0, cursorMs, total),
      labelPlacement: ms / total >= MIN_LABEL_FRACTION ? "above" : "legend",
    };
    cursorMs += ms;
    return segment;
  });

  return {
    segments,
    totalMs: total,
    legend: segments.filter((s) => s.labelPlacement === "legend"),
  };
}

/**
 * The hesitations inside a step, positioned on the whole-solve scale.
 *
 * These are what makes the reference app's F2L look like several chunks rather than one block, and
 * they're the most useful thing on the bar: a wide dark gap is a recognition problem, a run of
 * narrow ones is a lookahead problem.
 */
function pausesIn(
  step: SolveStep,
  moves: readonly TimedMove[],
  t0: number,
  segmentStartMs: number,
  total: number
): Array<{ start: number; width: number }> {
  const out: Array<{ start: number; width: number }> = [];
  // The step's recognition time is itself a pause, drawn at the segment's head.
  if (step.recognitionMs > PAUSE_MS) {
    out.push({ start: segmentStartMs / total, width: step.recognitionMs / total });
  }
  for (let i = step.startIndex + 1; i <= step.endIndex && i < moves.length; i++) {
    const gap = moves[i].t - moves[i - 1].t;
    if (gap <= PAUSE_MS) continue;
    // Position relative to the solve's first move, which is where `analysis.totalMs` starts.
    out.push({ start: (moves[i - 1].t - t0) / total, width: gap / total });
  }
  return out;
}
