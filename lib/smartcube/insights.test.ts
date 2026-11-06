import { describe, expect, it } from "vitest";
import { headlineInsight, summariseSession } from "./insights";
import type { SolveAnalysis, SolveStep, StepName } from "./analysis";

const step = (name: StepName, recognitionMs: number, executionMs: number, moveCount = 6): SolveStep => ({
  name,
  label: name.toUpperCase(),
  startIndex: 0,
  endIndex: moveCount - 1,
  recognitionMs,
  executionMs,
  moveCount,
  tps: executionMs > 0 ? ((moveCount - 1) / executionMs) * 1000 : 0,
  pauseCount: 0,
});

const analysis = (steps: SolveStep[], overrides: Partial<SolveAnalysis> = {}): SolveAnalysis => {
  const totalMs = steps.reduce((sum, s) => sum + s.recognitionMs + s.executionMs, 0);
  return {
    method: "cfop",
    steps,
    totalMs,
    moveCount: steps.reduce((sum, s) => sum + s.moveCount, 0),
    tps: 5,
    pauseCount: 1,
    crossColor: "D",
    confidence: "high",
    ...overrides,
  };
};

describe("session insights", () => {
  it("averages each step across solves", () => {
    const solves = [
      analysis([step("cross", 100, 900), step("oll", 1000, 1000)]),
      analysis([step("cross", 300, 700), step("oll", 2000, 1000)]),
    ];
    const result = summariseSession(solves);

    expect(result.analysed).toBe(2);
    const cross = result.steps.find((s) => s.name === "cross")!;
    expect(cross.avgRecognitionMs).toBe(200);
    expect(cross.avgExecutionMs).toBe(800);
    expect(cross.avgTotalMs).toBe(1000);
  });

  it("names the step costing the most, and says which half it is", () => {
    const solves = Array.from({ length: 4 }, () =>
      analysis([step("cross", 100, 400), step("oll", 2500, 500), step("pll", 200, 900)])
    );
    const result = summariseSession(solves);

    expect(result.worstStep?.name).toBe("oll");
    // 2.5 s of looking against 0.5 s of turning: a recognition problem.
    expect(result.worstStep?.dominantPhase).toBe("recognition");
    expect(headlineInsight(result)).toMatch(/looking rather than turning/);
  });

  it("calls out slow turning when that's what it is", () => {
    const solves = Array.from({ length: 4 }, () =>
      analysis([step("cross", 100, 400), step("f2l1", 200, 4000, 20)])
    );
    const result = summariseSession(solves);
    expect(result.worstStep?.dominantPhase).toBe("execution");
    expect(headlineInsight(result)).toMatch(/turns per second/);
  });

  it("stays quiet until there's enough evidence", () => {
    const one = summariseSession([analysis([step("cross", 100, 400), step("oll", 2000, 500)])]);
    expect(headlineInsight(one)).toBeNull();
  });

  it("won't call a step the worst on a single appearance", () => {
    const common = Array.from({ length: 6 }, () =>
      analysis([step("cross", 100, 400), step("pll", 300, 1200)])
    );
    // One solve had a monstrous OLL; it shouldn't dominate the verdict.
    const odd = analysis([step("cross", 100, 400), step("oll", 9000, 500), step("pll", 300, 1200)]);
    const result = summariseSession([...common, odd]);
    expect(result.worstStep?.name).toBe("pll");
  });

  it("counts solves it couldn't break down without discarding them", () => {
    const result = summariseSession([
      analysis([step("cross", 100, 400), step("pll", 100, 400)]),
      analysis([], { method: "unknown", steps: [], confidence: "low", reason: "not CFOP" }),
    ]);
    expect(result.analysed).toBe(1);
    expect(result.unanalysed).toBe(1);
  });

  it("handles an empty session", () => {
    const result = summariseSession([]);
    expect(result.analysed).toBe(0);
    expect(result.steps).toEqual([]);
    expect(result.worstStep).toBeNull();
    expect(headlineInsight(result)).toBeNull();
  });
});
