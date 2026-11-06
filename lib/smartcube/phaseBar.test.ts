import { describe, expect, it } from "vitest";
import { MIN_LABEL_FRACTION, phaseBarLayout } from "./phaseBar";
import type { SolveAnalysis, SolveStep, StepName } from "./analysis";
import type { TimedMove } from "./moveStream";

const step = (
  name: StepName,
  recognitionMs: number,
  executionMs: number,
  startIndex = 0,
  endIndex = 0
): SolveStep => ({
  name,
  label: name.toUpperCase(),
  startIndex,
  endIndex,
  recognitionMs,
  executionMs,
  moveCount: endIndex - startIndex + 1,
  tps: 5,
  pauseCount: 0,
});

const analysis = (steps: SolveStep[]): SolveAnalysis => ({
  method: "cfop",
  steps,
  totalMs: steps.reduce((sum, s) => sum + s.recognitionMs + s.executionMs, 0),
  moveCount: 50,
  turns: 45,
  tps: 4,
  fluency: 0.7,
  pauseCount: 3,
  crossColor: "D",
  confidence: "high",
});

describe("phase bar layout", () => {
  it("covers the whole solve with no gap or overlap", () => {
    const layout = phaseBarLayout(
      analysis([step("cross", 500, 1_500), step("f2l1", 300, 2_000), step("oll", 800, 1_200)]),
      []
    )!;

    const total = layout.segments.reduce((sum, s) => sum + s.width, 0);
    expect(total).toBeCloseTo(1, 10);
    // Each segment starts exactly where the last ended — the spec's bar covers 100% of the solve.
    layout.segments.forEach((segment, i) => {
      const expected = layout.segments.slice(0, i).reduce((sum, s) => sum + s.width, 0);
      expect(segment.start).toBeCloseTo(expected, 10);
    });
  });

  it("sums segment times back to the solve time", () => {
    // Acceptance criterion 5: the segments must add up to the total.
    const a = analysis([step("cross", 500, 1_500), step("f2l1", 300, 2_000)]);
    const layout = phaseBarLayout(a, [])!;
    expect(layout.segments.reduce((sum, s) => sum + s.ms, 0)).toBe(a.totalMs);
  });

  it("moves a narrow segment's label to the legend instead of overlapping", () => {
    // This is the reference app's bug: OLL at 4.71 and PLL at 8.94 collide when the segments are
    // thin. A narrow segment gets a legend entry rather than a squeezed label.
    const layout = phaseBarLayout(
      analysis([
        step("cross", 0, 40_000), // dominates
        step("oll", 100, 200), //    ~0.7% — far too narrow to label
        step("pll", 100, 200),
      ]),
      []
    )!;

    const [cross, oll, pll] = layout.segments;
    expect(cross.labelPlacement).toBe("above");
    expect(oll.labelPlacement).toBe("legend");
    expect(pll.labelPlacement).toBe("legend");
    expect(layout.legend.map((s) => s.name)).toEqual(["oll", "pll"]);
  });

  it("labels every segment in place when they're all wide enough", () => {
    const layout = phaseBarLayout(
      analysis([step("cross", 0, 1_000), step("f2l1", 0, 1_000), step("oll", 0, 1_000)]),
      []
    )!;
    expect(layout.segments.every((s) => s.labelPlacement === "above")).toBe(true);
    expect(layout.legend).toEqual([]);
  });

  it("places the threshold where a label just fits", () => {
    const wide = phaseBarLayout(analysis([step("cross", 0, MIN_LABEL_FRACTION * 1_000), step("f2l1", 0, (1 - MIN_LABEL_FRACTION) * 1_000)]), [])!;
    expect(wide.segments[0].labelPlacement).toBe("above");
  });

  it("draws the recognition pause at the head of its segment", () => {
    const layout = phaseBarLayout(analysis([step("cross", 0, 1_000), step("oll", 1_000, 1_000)]), [])!;
    const oll = layout.segments[1];
    // The 1 s think before OLL's first move starts exactly where the segment does.
    expect(oll.pauses[0].start).toBeCloseTo(oll.start, 10);
    expect(oll.pauses[0].width).toBeCloseTo(1_000 / 3_000, 10);
  });

  it("finds hesitations between moves inside a step", () => {
    // Turning, a 900 ms stop, then turning again.
    const moves: TimedMove[] = [
      { move: "R", t: 0 },
      { move: "U", t: 100 },
      { move: "F", t: 1_000 },
      { move: "L", t: 1_100 },
    ];
    const layout = phaseBarLayout(analysis([step("cross", 0, 1_100, 0, 3)]), moves)!;
    const pauses = layout.segments[0].pauses;
    expect(pauses).toHaveLength(1);
    expect(pauses[0].start).toBeCloseTo(100 / 1_100, 10);
    expect(pauses[0].width).toBeCloseTo(900 / 1_100, 10);
  });

  it("returns nothing to draw rather than an empty bar", () => {
    expect(phaseBarLayout(null, [])).toBeNull();
    expect(phaseBarLayout(analysis([]), [])).toBeNull();
    // A zero-length solve would divide by zero.
    expect(phaseBarLayout(analysis([step("cross", 0, 0)]), [])).toBeNull();
  });
});
