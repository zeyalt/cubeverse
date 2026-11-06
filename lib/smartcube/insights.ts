/**
 * Cross-solve insights: where the time actually goes, averaged over a session.
 *
 * One solve tells you little — every solve has a slow step. The useful question is which step is
 * *consistently* slow, and whether it's recognition or execution, because those are fixed in
 * completely different ways: recognition by drilling cases until you see them instantly, execution
 * by turning faster and with fewer pauses.
 *
 * Pure, so it can be tested without a cube or a browser.
 */

import type { SolveAnalysis, StepName, SolveStep } from "./analysis";

export interface StepSummary {
  name: StepName;
  label: string;
  /** How many solves contributed — a step can be skipped (OLL/PLL skips, free pairs). */
  count: number;
  avgRecognitionMs: number;
  avgExecutionMs: number;
  avgTotalMs: number;
  avgMoveCount: number;
  avgTps: number;
  /** Share of the average solve spent here, 0-1. */
  shareOfSolve: number;
}

export interface SessionInsights {
  /** Solves that produced a usable breakdown. */
  analysed: number;
  /** Solves recorded but not broken down (non-CFOP, dropped turns, DNFs). */
  unanalysed: number;
  steps: StepSummary[];
  /** The step costing the most time on average, with why. */
  worstStep: (StepSummary & { dominantPhase: "recognition" | "execution" }) | null;
  avgTotalMs: number;
  avgMoveCount: number;
  avgTps: number;
  /** Average hesitations per solve. */
  avgPauses: number;
}

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

const STEP_ORDER: StepName[] = ["cross", "f2l1", "f2l2", "f2l3", "f2l4", "oll", "pll"];

export function summariseSession(analyses: readonly SolveAnalysis[]): SessionInsights {
  const usable = analyses.filter((a) => a.method === "cfop" && a.steps.length > 0);
  const unanalysed = analyses.length - usable.length;

  const byStep = new Map<StepName, SolveStep[]>();
  for (const analysis of usable) {
    for (const step of analysis.steps) {
      const list = byStep.get(step.name) ?? [];
      list.push(step);
      byStep.set(step.name, list);
    }
  }

  const avgTotalMs = mean(usable.map((a) => a.totalMs));

  const steps: StepSummary[] = STEP_ORDER.flatMap((name) => {
    const entries = byStep.get(name);
    if (!entries?.length) return [];
    const avgRecognitionMs = mean(entries.map((s) => s.recognitionMs));
    const avgExecutionMs = mean(entries.map((s) => s.executionMs));
    const avgTotalStepMs = avgRecognitionMs + avgExecutionMs;
    return [
      {
        name,
        label: entries[0].label,
        count: entries.length,
        avgRecognitionMs,
        avgExecutionMs,
        avgTotalMs: avgTotalStepMs,
        avgMoveCount: mean(entries.map((s) => s.moveCount)),
        avgTps: mean(entries.map((s) => s.tps)),
        shareOfSolve: avgTotalMs > 0 ? avgTotalStepMs / avgTotalMs : 0,
      },
    ];
  });

  // Only steps seen in most solves can be called "your worst" — a step that appeared once isn't
  // evidence of anything.
  const representative = steps.filter((s) => s.count >= Math.max(1, Math.ceil(usable.length / 2)));
  const worst = [...representative].sort((a, b) => b.avgTotalMs - a.avgTotalMs)[0] ?? null;

  return {
    analysed: usable.length,
    unanalysed,
    steps,
    worstStep: worst
      ? {
          ...worst,
          dominantPhase: worst.avgRecognitionMs > worst.avgExecutionMs ? "recognition" : "execution",
        }
      : null,
    avgTotalMs,
    avgMoveCount: mean(usable.map((a) => a.moveCount)),
    avgTps: mean(usable.map((a) => a.tps)),
    avgPauses: mean(usable.map((a) => a.pauseCount)),
  };
}

/** Plain-language reading of the session, or null when there isn't enough to say anything honest. */
export function headlineInsight(insights: SessionInsights): string | null {
  if (insights.analysed < 3 || !insights.worstStep) return null;
  const worst = insights.worstStep;
  const share = Math.round(worst.shareOfSolve * 100);
  if (worst.dominantPhase === "recognition") {
    return `${worst.label} takes ${share}% of your solve, and most of it is spent looking rather than turning — that's a case-recognition problem, not a speed one.`;
  }
  return `${worst.label} takes ${share}% of your solve, and most of it is turning — ${worst.avgTps.toFixed(1)} turns per second against ${insights.avgTps.toFixed(1)} overall.`;
}
