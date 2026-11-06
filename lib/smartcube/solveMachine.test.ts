import { describe, expect, it } from "vitest";
import { SOLVED, applyMove, applyMoves, splitMoves } from "./facelets";
import {
  INITIAL_SOLVE,
  INSPECTION_DNF_MS,
  INSPECTION_LIMIT_MS,
  reduceSolve,
  solveTimeCs,
  solveTps,
  type SolveEvent,
  type SolveState,
} from "./solveMachine";

const SCRAMBLE = "R U R' U' F2";
const TARGET = applyMoves(SOLVED, SCRAMBLE);

const run = (events: SolveEvent[], from: SolveState = INITIAL_SOLVE) =>
  events.reduce(reduceSolve, from);

/** Drives the machine the way the hook does: applying each move to the model as it goes. */
function turn(state: SolveState, facelets: string, moves: string[], startMs = 0, stepMs = 100) {
  let current = state;
  let model = facelets;
  moves.forEach((move, i) => {
    model = applyMove(model, move);
    const ts = startMs + i * stepMs;
    current = reduceSolve(current, { type: "move", move, cubeTs: ts, localTs: ts, after: model });
  });
  return { state: current, model };
}

const scrambleEvent: SolveEvent = {
  type: "scramble",
  scramble: SCRAMBLE,
  target: TARGET,
  facelets: SOLVED,
};

describe("solve machine", () => {
  describe("applying the scramble", () => {
    it("becomes ready exactly when the cube matches the scramble", () => {
      let state = run([scrambleEvent]);
      expect(state.phase).toBe("scrambling");

      const moves = splitMoves(SCRAMBLE);
      const result = turn(state, SOLVED, moves);
      state = result.state;

      expect(state.phase).toBe("ready");
      expect(state.wrongTurns).toBe(0);
      expect(state.remaining).toEqual([]);
    });

    it("counts a wrong turn without blocking, and still becomes ready after recovery", () => {
      const state = run([scrambleEvent]);
      // Turn D, undo it, then apply the scramble properly.
      const detour = turn(state, SOLVED, ["D", "D'"]);
      expect(detour.state.phase).toBe("scrambling");
      expect(detour.state.wrongTurns).toBe(2);

      const recovered = turn(detour.state, detour.model, splitMoves(SCRAMBLE));
      expect(recovered.state.phase).toBe("ready");
      expect(recovered.state.wrongTurns).toBe(2);
    });

    it("tracks the next expected move while the solver is on track", () => {
      let state = run([scrambleEvent]);
      expect(state.remaining[0]).toBe("R");
      const { state: next } = turn(state, SOLVED, ["R"]);
      state = next;
      expect(state.remaining[0]).toBe("U");
    });

    it("drops back to scrambling if the cube is disturbed after being ready", () => {
      const ready = turn(run([scrambleEvent]), SOLVED, splitMoves(SCRAMBLE));
      expect(ready.state.phase).toBe("ready");
      const disturbed = turn(ready.state, ready.model, ["D"]);
      expect(disturbed.state.phase).toBe("scrambling");
    });

    it("skips straight to ready if the cube already matches", () => {
      const state = run([{ ...scrambleEvent, facelets: TARGET }]);
      expect(state.phase).toBe("ready");
    });
  });

  describe("timing", () => {
    /** Scramble applied, inspection started: the state just before a solve begins. */
    const readyToSolve = () => {
      const ready = turn(run([scrambleEvent]), SOLVED, splitMoves(SCRAMBLE));
      return {
        state: reduceSolve(ready.state, { type: "startInspection", now: 0 }),
        model: ready.model,
      };
    };

    it("starts on the first turn and stops the instant the cube is solved", () => {
      const { state, model } = readyToSolve();
      expect(state.phase).toBe("inspecting");

      // Undoing the scramble solves it: F2 U R U' R'
      const solution = splitMoves("F2 U R U' R'");
      const solved = turn(state, model, solution, 50_000, 200);

      expect(solved.state.phase).toBe("solved");
      expect(solved.state.moves.map((m) => m.move)).toEqual(solution);
      // Times are relative to the first move of the solve, not to the cube's clock.
      expect(solved.state.moves[0].t).toBe(0);
      expect(solved.state.moves.at(-1)!.t).toBe(800);
      expect(solveTimeCs(solved.state)).toBe(80);
      expect(solveTps(solved.state)).toBeCloseTo(6.25, 5);
    });

    it("prefers the cube's clock and records when it had to fall back", () => {
      const { state, model } = readyToSolve();
      let current = state;
      let facelets = model;
      splitMoves("F2 U R U' R'").forEach((move, i) => {
        facelets = applyMove(facelets, move);
        current = reduceSolve(current, {
          type: "move",
          move,
          cubeTs: null, // cube clock unavailable
          localTs: i * 150,
          after: facelets,
        });
      });
      expect(current.phase).toBe("solved");
      expect(current.timingSource).toBe("local");
      expect(solveTimeCs(current)).toBe(60);
    });

    it("ignores moves made after the cube is solved", () => {
      const { state, model } = readyToSolve();
      const solved = turn(state, model, splitMoves("F2 U R U' R'"), 0, 100);
      const after = turn(solved.state, solved.model, ["R", "U"], 9_999);
      expect(after.state.moves).toHaveLength(5);
      expect(solveTimeCs(after.state)).toBe(solveTimeCs(solved.state));
    });
  });

  describe("inspection penalties", () => {
    const inspecting = () => {
      const ready = turn(run([scrambleEvent]), SOLVED, splitMoves(SCRAMBLE));
      return reduceSolve(ready.state, { type: "startInspection", now: 1_000 });
    };

    it("gives +2 past 15 seconds", () => {
      const state = reduceSolve(inspecting(), { type: "tick", now: 1_000 + INSPECTION_LIMIT_MS });
      expect(state.penalty).toBe("plus2");
      expect(state.phase).toBe("inspecting");
    });

    it("adds the +2 to the recorded time", () => {
      const ready = turn(run([scrambleEvent]), SOLVED, splitMoves(SCRAMBLE));
      let state = reduceSolve(ready.state, { type: "startInspection", now: 0 });
      state = reduceSolve(state, { type: "tick", now: INSPECTION_LIMIT_MS });
      const solved = turn(state, ready.model, splitMoves("F2 U R U' R'"), 0, 100);
      // 400 ms of turning = 40 cs, plus the 200 cs penalty.
      expect(solveTimeCs(solved.state)).toBe(240);
    });

    it("DNFs past 17 seconds", () => {
      const state = reduceSolve(inspecting(), { type: "tick", now: 1_000 + INSPECTION_DNF_MS });
      expect(state.penalty).toBe("dnf");
      expect(state.phase).toBe("solved");
      expect(solveTimeCs(state)).toBeNull();
    });

    it("only starts inspection from ready", () => {
      const state = reduceSolve(run([scrambleEvent]), { type: "startInspection", now: 0 });
      expect(state.phase).toBe("scrambling");
    });
  });

  it("flags a solve whose state had to be corrected mid-way", () => {
    const ready = turn(run([scrambleEvent]), SOLVED, splitMoves(SCRAMBLE));
    let state = reduceSolve(ready.state, { type: "startInspection", now: 0 });
    const partial = turn(state, ready.model, ["F2"], 0);
    state = reduceSolve(partial.state, { type: "facelets", facelets: SOLVED, localTs: 10 });
    expect(state.resynced).toBe(true);

    const solved = turn(state, partial.model, splitMoves("U R U' R'"), 200, 100);
    // The solve is still recorded — drift lowers confidence, it never discards work.
    expect(solved.state.phase).toBe("solved");
    expect(solved.state.resynced).toBe(true);
    expect(solveTimeCs(solved.state)).not.toBeNull();
  });

  it("resets cleanly", () => {
    const ready = turn(run([scrambleEvent]), SOLVED, splitMoves(SCRAMBLE));
    expect(reduceSolve(ready.state, { type: "reset" })).toEqual(INITIAL_SOLVE);
  });
});
