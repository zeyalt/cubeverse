import { describe, expect, it } from "vitest";
import {
  GOAL_SHARE,
  averageSplits,
  defaultGoalMs,
  goalSplits,
  isPlausible,
  phaseSplits,
  phaseStarts,
  splitTip,
  tpsSeries,
  type InsightSolve,
} from "./insights";
import type { SolveAnalysis, SolveStep, StepName } from "./analysis";

/** A step occupying moves [startIndex, endIndex]. */
const step = (
  name: StepName,
  recognitionMs: number,
  executionMs: number,
  startIndex: number,
  endIndex: number
): SolveStep => ({
  name,
  label: name,
  startIndex,
  endIndex,
  recognitionMs,
  executionMs,
  moveCount: endIndex - startIndex + 1,
  tps: 0,
  pauseCount: 0,
});

const analysisOf = (steps: SolveStep[]): SolveAnalysis => ({
  method: "cfop",
  steps,
  totalMs: steps.reduce((sum, s) => sum + s.recognitionMs + s.executionMs, 0),
  moveCount: 0,
  turns: 0,
  tps: 0,
  fluency: 1,
  pauseCount: 0,
  crossColor: "D",
  confidence: "high",
});

/**
 * A solve with the given phase times. Each phase gets ten distinct-face moves, so ten HTM turns,
 * with the first move of each phase at the end of its recognition pause.
 */
function solveWith(phaseMs: { cross: number; f2l: number; oll: number; pll: number }, lookFraction = 0.25): InsightSolve {
  const faces = ["R", "U", "F", "L", "D", "B"];
  const moves: { move: string; t: number }[] = [];
  const steps: SolveStep[] = [];
  let cursor = 0;
  const phases: Array<[StepName, number]> = [
    ["cross", phaseMs.cross],
    ["f2l1", phaseMs.f2l],
    ["oll", phaseMs.oll],
    ["pll", phaseMs.pll],
  ];
  for (const [name, ms] of phases) {
    const start = moves.length;
    const look = name === "cross" ? 0 : ms * lookFraction;
    const exe = ms - look;
    for (let i = 0; i < 10; i++) {
      moves.push({ move: faces[moves.length % 6], t: cursor + look + (exe * i) / 9 });
    }
    steps.push(step(name, look, exe, start, moves.length - 1));
    cursor += ms;
  }
  return { analysis: analysisOf(steps), moves };
}

const balanced = () => solveWith({ cross: 4_000, f2l: 15_500, oll: 4_500, pll: 6_000 });

describe("plausibility", () => {
  it("rejects the corrupted solve stored on 2026-11-06", () => {
    // Real numbers from the database: Cross recorded as 0 ms across 21 moves, then F2L 1 with a
    // 5.7-hour recognition time inside a 46-second solve. Averaged in, it made a step "take 16347%
    // of your solve".
    const corrupted: SolveAnalysis = {
      ...analysisOf([
        step("cross", 0, 0, 0, 20),
        step("f2l1", 20_751_077.1, 1_120, 21, 28),
        step("f2l2", 1_647, 5_320, 29, 42),
      ]),
      totalMs: 45_920,
    };
    expect(isPlausible(corrupted)).toBe(false);
  });

  it("accepts a solve whose steps add up to it", () => {
    expect(isPlausible(balanced().analysis)).toBe(true);
  });

  it("rejects a negative step and an unanalysed solve", () => {
    expect(isPlausible(analysisOf([step("cross", -5, 100, 0, 1)]))).toBe(false);
    expect(isPlausible(null)).toBe(false);
    expect(isPlausible({ ...balanced().analysis!, method: "unknown" })).toBe(false);
  });
});

describe("phase splits", () => {
  it("folds the four F2L pairs into one phase", () => {
    const moves = Array.from({ length: 8 }, (_, i) => ({ move: ["R", "U"][i % 2], t: i * 100 }));
    const analysis = analysisOf([
      step("cross", 0, 100, 0, 1),
      step("f2l1", 50, 50, 2, 3),
      step("f2l2", 50, 50, 4, 5),
      step("f2l3", 50, 50, 6, 7),
    ]);
    const f2l = phaseSplits({ analysis, moves })!.find((p) => p.phase === "f2l")!;
    expect(f2l.ms).toBe(300);
    expect(f2l.recognitionMs).toBe(150);
    expect(f2l.turns).toBe(6);
  });

  it("counts a skipped OLL as zero time rather than leaving it out", () => {
    const solve = solveWith({ cross: 4_000, f2l: 15_000, oll: 0, pll: 6_000 });
    // Drop the OLL step entirely, as the analysis does on a skip.
    solve.analysis!.steps = solve.analysis!.steps.filter((s) => s.name !== "oll");
    solve.analysis!.totalMs = 25_000;
    const oll = phaseSplits(solve)!.find((p) => p.phase === "oll")!;
    expect(oll.ms).toBe(0);
    expect(oll.tps).toBe(0);
  });

  it("measures TPS over the phase's whole time, thinking included", () => {
    // That is how the reference app quotes it: 15.3 turns over a 5.89 s cross is 2.59 TPS.
    const oll = phaseSplits(balanced())!.find((p) => p.phase === "oll")!;
    expect(oll.tps).toBeCloseTo(10 / 4.5, 5);
  });
});

describe("average splits", () => {
  it("stays silent below three trustworthy solves", () => {
    expect(averageSplits([balanced(), balanced()])).toBeNull();
  });

  it("leaves untrustworthy solves out of the average", () => {
    const corrupted: InsightSolve = {
      analysis: { ...analysisOf([step("cross", 0, 0, 0, 1), step("f2l1", 20_751_077, 1_000, 2, 3)]), totalMs: 45_920 },
      moves: [],
    };
    const summary = averageSplits([balanced(), balanced(), balanced(), corrupted])!;
    expect(summary.count).toBe(3);
    expect(summary.totalMs).toBeCloseTo(30_000, 5);
  });

  it("gives shares that add up to 100%", () => {
    const summary = averageSplits([
      balanced(),
      solveWith({ cross: 8_000, f2l: 20_000, oll: 5_000, pll: 7_000 }),
      solveWith({ cross: 3_000, f2l: 14_000, oll: 4_000, pll: 5_000 }),
    ])!;
    expect(summary.phases.reduce((sum, p) => sum + p.share, 0)).toBeCloseTo(1, 10);
  });
});

describe("goals", () => {
  it("splits a goal by the standard CFOP proportions", () => {
    const goal = goalSplits(30_000);
    expect(goal.map((g) => Math.round(g.ms))).toEqual([4_000, 15_500, 4_500, 6_000]);
    expect(Object.values(GOAL_SHARE).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  it("suggests a goal about a fifth faster, in whole seconds", () => {
    expect(defaultGoalMs(37_680)).toBe(30_000);
    expect(defaultGoalMs(3_000)).toBe(5_000); // never absurdly low
  });
});

describe("tips", () => {
  const avg = (solve: () => InsightSolve) => averageSplits([solve(), solve(), solve()])!;

  it("calls balanced splits balanced", () => {
    expect(splitTip(avg(balanced)).tone).toBe("good");
  });

  it("names the phase that takes too large a share, and says whether it's looking or turning", () => {
    // A cross taking 30% of the solve, mostly spent turning.
    const slowCross = () => solveWith({ cross: 9_000, f2l: 13_000, oll: 3_500, pll: 4_500 });
    const tip = splitTip(avg(slowCross));
    expect(tip.tone).toBe("focus");
    expect(tip.text).toMatch(/^Cross takes 30%/);
    expect(tip.text).toMatch(/turning/);
  });

  it("says it's a recognition problem when the time goes on looking", () => {
    const slowLookingPll = () =>
      solveWith({ cross: 3_500, f2l: 13_000, oll: 4_000, pll: 9_500 }, 0.6);
    const tip = splitTip(avg(slowLookingPll));
    expect(tip.text).toMatch(/^PLL/);
    expect(tip.text).toMatch(/looking/);
  });

  it("judges shares, not times, so a faster goal doesn't make every phase a problem", () => {
    // Every phase is slower than a 20 s goal; none is out of proportion. Not a problem to name.
    const slowButBalanced = () => solveWith({ cross: 8_000, f2l: 31_000, oll: 9_000, pll: 12_000 });
    expect(splitTip(avg(slowButBalanced)).tone).toBe("good");
  });
});

describe("TPS through a solve", () => {
  /** Area under the curve in turns: TPS integrated over the 100 ms samples. */
  const area = (series: { tps: number }[]) => series.reduce((sum, p) => sum + p.tps * 0.1, 0);

  it("reads a steady pace as that pace", () => {
    // Forty turns, one every 100 ms: a steady 10 TPS. Checked in the middle, away from the start
    // and end where the curve is still rising and falling.
    const moves = Array.from({ length: 40 }, (_, i) => ({ move: ["R", "U"][i % 2], t: i * 100 }));
    const series = tpsSeries({ analysis: analysisOf([step("cross", 0, 3_900, 0, 39)]), moves });
    const middle = series[Math.floor(series.length / 2)];
    expect(middle.tps).toBeCloseTo(10, 1);
  });

  it("is smooth: no jump between samples bigger than the pace allows", () => {
    // The old sliding-window count jumped by a full turn per second at every sample a turn crossed
    // the window's edge, which is what drew the staircase.
    const moves = Array.from({ length: 30 }, (_, i) => ({ move: ["R", "U", "F"][i % 3], t: i * 300 }));
    const series = tpsSeries({ analysis: analysisOf([step("cross", 0, 8_700, 0, 29)]), moves });
    const middle = series.slice(10, -10);
    for (let i = 1; i < middle.length; i++) {
      expect(Math.abs(middle[i].tps - middle[i - 1].tps)).toBeLessThan(0.5);
    }
  });

  it("counts a half turn once", () => {
    // R R is R2 as the cube reports it: one turn, so the curve holds two turns' worth, not three.
    // The stream is padded on both sides so no turn's curve is cut off at the edges.
    const moves = [
      { move: "F", t: 0 },
      { move: "R", t: 2_000 },
      { move: "R", t: 2_050 },
      { move: "U", t: 2_100 },
      { move: "L", t: 4_000 },
    ];
    const series = tpsSeries({ analysis: analysisOf([step("cross", 0, 4_000, 0, 4)]), moves });
    const inner = series.filter((p) => p.t > 0.8 && p.t < 3.2);
    expect(area(inner)).toBeCloseTo(2, 1);
  });

  it("labels each point with the phase being solved", () => {
    const series = tpsSeries(balanced());
    expect(series[0].phase).toBe("cross");
    expect(series.at(-1)!.phase).toBe("pll");
  });

  it("marks where each phase starts, thinking time included", () => {
    expect(phaseStarts(balanced())).toEqual([
      { phase: "f2l", t: 4 },
      { phase: "oll", t: 19.5 },
      { phase: "pll", t: 24 },
    ]);
  });

  it("draws nothing for a solve it can't trust", () => {
    expect(tpsSeries({ analysis: null, moves: [] })).toEqual([]);
  });
});
