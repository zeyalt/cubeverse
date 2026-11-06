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

import { PAUSE_MS, type SolveAnalysis, type SolveStep, type StepName } from "./analysis";
import type { TimedMove } from "./moveStream";

export interface PhaseSegment {
  name: StepName;
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
 * Room a label needs, in pixels: "F2L 4" in 9 px caps, or "18.03" in 11 px figures, plus a gap so
 * neighbouring labels never touch.
 */
export const LABEL_WIDTH_PX = 44;

/** Assumed bar width when the real one isn't known yet: a phone's card, the tightest case. */
export const DEFAULT_BAR_WIDTH_PX = 320;

/**
 * Build the bar from an analysis and its move stream. Returns null when there's nothing to draw.
 *
 * Labels are placed left to right, each one only if it starts clear of the label before it. A rule
 * that judged each segment on its own width let "F2L 4" and "OLL" run together: each fitted its own
 * segment, but a label sits at its segment's start and is wider than a narrow segment, so it spills
 * into the next. Whether labels collide depends on their neighbours, so that's what gets checked. A
 * label that doesn't get a place moves to the legend, so no number is ever lost.
 */
export function phaseBarLayout(
  analysis: SolveAnalysis | null,
  moves: readonly TimedMove[],
  barWidthPx: number = DEFAULT_BAR_WIDTH_PX
): PhaseBarLayout | null {
  if (!analysis || analysis.steps.length === 0 || analysis.totalMs <= 0) return null;

  const total = analysis.totalMs;
  const t0 = moves.length ? moves[0].t : 0;
  const labelWidth = LABEL_WIDTH_PX / Math.max(barWidthPx, 1);
  let cursorMs = 0;
  // Right edge of the last label placed, as a fraction of the bar.
  let labelsEndAt = -Infinity;

  const segments: PhaseSegment[] = analysis.steps.map((step) => {
    const ms = step.recognitionMs + step.executionMs;
    const start = cursorMs / total;
    // Clear of the previous label, and not running off the bar's right end.
    const fits = start >= labelsEndAt && start + labelWidth <= 1 + 1e-9;
    if (fits) labelsEndAt = start + labelWidth;
    cursorMs += ms;
    return {
      name: step.name,
      label: step.label,
      start,
      width: ms / total,
      ms,
      pauses: pausesIn(step, moves, t0, start * total, total),
      labelPlacement: fits ? "above" : "legend",
    };
  });

  return {
    segments,
    totalMs: total,
    legend: segments.filter((x) => x.labelPlacement === "legend"),
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
