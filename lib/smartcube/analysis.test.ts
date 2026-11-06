import { describe, expect, it } from "vitest";
import { SOLVED, applyMoves, splitMoves } from "./facelets";
import { analyseSolve, fluency, htmTurns, PAUSE_MS } from "./analysis";
import type { TimedMove } from "./moveStream";

/**
 * Solves are built backwards from a known solution: apply its inverse to a solved cube and you get
 * a scramble whose solution is, by construction, exactly that sequence with exactly those step
 * boundaries. That gives ground truth to check the detector against without needing a solver.
 */
const invert = (sequence: string): string =>
  splitMoves(sequence)
    .reverse()
    .map((m) => (m.endsWith("2") ? m : m.endsWith("'") ? m.slice(0, -1) : `${m}'`))
    .join(" ");

/**
 * Found by searching constructions until one had the property a hand-written fixture needs: the
 * cross completes with *zero* F2L pairs accidentally solved, and each alg then completes exactly
 * one more. The obvious hand-picked algs didn't — two of them worked the same slot, so the cross
 * landed with two pairs already done, and the detector was right while the test was wrong.
 */
const CROSS = "R F2 L2 F L2";
const F2L = ["R U' R'", "L' U L", "U' B' U B", "R' U' R"];
const OLL = "R U R' U R U2 R'"; // Sune
const PLL = "R U R' U' R' F R2 U' R' U' R U R' F'"; // T-perm

type Built = { scrambled: string; moves: TimedMove[]; stepSizes: number[] };

/** @param gaps ms of thinking time before each step; within a step, moves are 100 ms apart. */
function buildSolve(parts: string[], gaps: number[] = []): Built {
  const solution = parts.join(" ");
  const scrambled = applyMoves(SOLVED, invert(solution));
  const moves: TimedMove[] = [];
  let t = 0;
  parts.forEach((part, stepIndex) => {
    splitMoves(part).forEach((move, moveIndex) => {
      t += moveIndex === 0 ? (gaps[stepIndex] ?? 0) : 100;
      moves.push({ move, t });
    });
  });
  return { scrambled, moves, stepSizes: parts.map((p) => splitMoves(p).length) };
}

describe("solve analysis", () => {
  it("finds every CFOP step in a full solve", () => {
    const { scrambled, moves, stepSizes } = buildSolve([CROSS, ...F2L, OLL, PLL]);
    const result = analyseSolve(scrambled, moves);

    expect(result.reason).toBeUndefined();
    expect(result.method).toBe("cfop");
    expect(result.confidence).toBe("high");
    expect(result.steps.map((s) => s.name)).toEqual([
      "cross", "f2l1", "f2l2", "f2l3", "f2l4", "oll", "pll",
    ]);
    expect(result.steps.map((s) => s.moveCount)).toEqual(stepSizes);
    // The solve ends with white on the bottom, so D is the cross colour.
    expect(result.crossColor).toBe("D");
    expect(result.moveCount).toBe(moves.length);
  });

  it("separates thinking time from turning time", () => {
    // 2 s staring at the cube before OLL, nothing before the others.
    const gaps = [0, 300, 300, 300, 300, 2000, 400];
    const { scrambled, moves } = buildSolve([CROSS, ...F2L, OLL, PLL], gaps);
    const result = analyseSolve(scrambled, moves);

    const oll = result.steps.find((s) => s.name === "oll")!;
    expect(oll.recognitionMs).toBe(2000);
    // Sune is 7 moves: 6 gaps of 100 ms.
    expect(oll.executionMs).toBe(600);
    expect(oll.tps).toBeCloseTo(10, 5);

    const cross = result.steps.find((s) => s.name === "cross")!;
    expect(cross.recognitionMs).toBe(0);

    // Recognition is measured from the end of the previous step, so the pauses are attributed to
    // the step the solver was thinking about — not the one they had just finished.
    const totalRecognition = result.steps.reduce((sum, s) => sum + s.recognitionMs, 0);
    expect(totalRecognition).toBe(gaps.reduce((a, b) => a + b, 0));
  });

  it("counts hesitations inside a step", () => {
    const { scrambled, moves } = buildSolve([CROSS, ...F2L, OLL, PLL]);
    // Insert a long stall in the middle of the T-perm.
    const stallAt = moves.length - 7;
    for (let i = stallAt; i < moves.length; i++) moves[i].t += PAUSE_MS * 4;
    const result = analyseSolve(scrambled, moves);
    expect(result.steps.find((s) => s.name === "pll")!.pauseCount).toBe(1);
    expect(result.pauseCount).toBeGreaterThanOrEqual(1);
  });

  it("handles an OLL skip without inventing a step", () => {
    const { scrambled, moves } = buildSolve([CROSS, ...F2L, PLL]);
    const result = analyseSolve(scrambled, moves);
    expect(result.method).toBe("cfop");
    expect(result.steps.map((s) => s.name)).toEqual([
      "cross", "f2l1", "f2l2", "f2l3", "f2l4", "pll",
    ]);
  });

  it("handles a PLL skip", () => {
    const { scrambled, moves } = buildSolve([CROSS, ...F2L, OLL]);
    const result = analyseSolve(scrambled, moves);
    expect(result.method).toBe("cfop");
    expect(result.steps.map((s) => s.name)).toContain("oll");
    expect(result.steps.map((s) => s.name)).not.toContain("pll");
  });

  it("still reports totals when it can't recognise the method", () => {
    // A scramble "solved" by undoing it move by move: valid, ends solved, but has no CFOP shape.
    const scramble = "R U F' L2 D B";
    const scrambled = applyMoves(SOLVED, scramble);
    const moves: TimedMove[] = splitMoves(invert(scramble)).map((move, i) => ({
      move,
      t: i * 120,
    }));
    const result = analyseSolve(scrambled, moves);

    expect(result.method).toBe("unknown");
    expect(result.steps).toEqual([]);
    expect(result.confidence).toBe("low");
    expect(result.reason).toBeTruthy();
    // The solve itself is never lost just because the breakdown failed.
    expect(result.moveCount).toBe(6);
    expect(result.totalMs).toBe(600);
    // Six turns on six different faces, so HTM agrees with the raw count here.
    expect(result.turns).toBe(6);
    expect(result.tps).toBeCloseTo(6 / 0.6, 5);
    // Every gap is 120 ms, so nothing counts as stopped.
    expect(result.fluency).toBe(1);
  });

  it("refuses to analyse a stream that doesn't end solved", () => {
    const { scrambled, moves } = buildSolve([CROSS, ...F2L, OLL, PLL]);
    const result = analyseSolve(scrambled, moves.slice(0, -3));
    expect(result.method).toBe("unknown");
    expect(result.reason).toMatch(/solved cube/);
  });

  it("returns something sane for an empty stream", () => {
    const result = analyseSolve(SOLVED, []);
    expect(result.method).toBe("unknown");
    expect(result.moveCount).toBe(0);
    expect(result.totalMs).toBe(0);
    expect(result.reason).toBeTruthy();
  });
});

describe("turn counting", () => {
  const at = (moves: string) => splitMoves(moves).map((move, i) => ({ move, t: i * 100 }));

  it("counts a half turn as one turn, however the cube reported it", () => {
    // The cube has no notion of a half turn: R2 reaches us as R, R. Counting those as two would
    // inflate the move count of every real solve, since every scramble and most algs contain them.
    expect(htmTurns(at("R R"))).toBe(1);
    expect(htmTurns(at("R2"))).toBe(1);
    expect(htmTurns(at("R U R' U'"))).toBe(4);
  });

  it("counts a change of mind as no turn at all", () => {
    expect(htmTurns(at("R R'"))).toBe(0);
    expect(htmTurns(at("U R R' U'"))).toBe(2);
  });

  it("does not merge turns on the same face that are separated by another", () => {
    expect(htmTurns(at("R U R"))).toBe(3);
  });

  it("counts four quarter turns of one face as nothing", () => {
    expect(htmTurns(at("R R R R"))).toBe(0);
  });
});

describe("fluency", () => {
  it("is 1 for a solve with no long gaps", () => {
    expect(fluency([{ move: "R", t: 0 }, { move: "U", t: 200 }, { move: "F", t: 400 }])).toBe(1);
  });

  it("drops by the share of time spent stopped", () => {
    // 100 ms of turning, then a 900 ms stop, then 100 ms more: 900 of 1100 ms stopped.
    const moves = [
      { move: "R", t: 0 },
      { move: "U", t: 100 },
      { move: "F", t: 1_000 },
      { move: "L", t: 1_100 },
    ];
    expect(fluency(moves)).toBeCloseTo(1 - 900 / 1100, 5);
  });

  it("is 1 rather than NaN for a stream too short to have gaps", () => {
    expect(fluency([])).toBe(1);
    expect(fluency([{ move: "R", t: 0 }])).toBe(1);
  });

  it("lands in the reference app's range for a slow, hesitant solve", () => {
    // The screenshot in the spec shows 1:15.09 at 1.61 TPS reported as 22% fluency. A solve that
    // slow is mostly thinking, so a definition that scored it near 100% would be useless.
    const moves: TimedMove[] = [];
    let t = 0;
    for (let i = 0; i < 60; i++) {
      // Two quick turns, then a long think: the shape of a 1:15 solve.
      moves.push({ move: "R", t });
      t += 150;
      moves.push({ move: "U", t });
      t += 1_000;
    }
    const f = fluency(moves);
    expect(f).toBeGreaterThan(0.1);
    expect(f).toBeLessThan(0.35);
  });
});
