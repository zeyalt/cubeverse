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
      // Turn D, undo it, then apply the scramble properly. Undoing a mistake is a correction, not
      // a second mistake, so this counts once.
      const detour = turn(state, SOLVED, ["D", "D'"]);
      expect(detour.state.phase).toBe("scrambling");
      expect(detour.state.wrongTurns).toBe(1);

      const recovered = turn(detour.state, detour.model, splitMoves(SCRAMBLE));
      expect(recovered.state.phase).toBe("ready");
      expect(recovered.state.wrongTurns).toBe(1);
    });

    it("tracks the next expected move while the solver is on track", () => {
      let state = run([scrambleEvent]);
      expect(state.remaining[0]).toBe("R");
      const { state: next } = turn(state, SOLVED, ["R"]);
      state = next;
      expect(state.remaining[0]).toBe("U");
    });

    it("treats the first turn after the scramble as the start of the solve", () => {
      // There is no way to tell "disturbing the scramble" from "starting to solve", and every
      // timer in the hobby treats the first turn as the start. Reading it as a disturbance meant
      // anyone who skipped inspection never got a timer.
      const ready = turn(run([scrambleEvent]), SOLVED, splitMoves(SCRAMBLE));
      expect(ready.state.phase).toBe("ready");
      const started = turn(ready.state, ready.model, ["D"]);
      expect(started.state.phase).toBe("solving");
      expect(started.state.moves).toHaveLength(1);
    });

    it("skips straight to ready if the cube already matches", () => {
      const state = run([{ ...scrambleEvent, facelets: TARGET }]);
      expect(state.phase).toBe("ready");
    });
  });

  describe("against a real WCA scramble", () => {
    // Every real scramble has half turns, and a cube can only report quarter turns — R2 arrives
    // as R, R. Comparing against the unexpanded scramble made all 19 moves of this one look
    // wrong, which is exactly what it did on real hardware.
    const WCA = "R2 U' F2 D2 L2 B' R U2 F' L D2 R2 U2 B2 L2 F2 D' B2 U'";
    const quarterTurns = (scramble: string) =>
      splitMoves(scramble).flatMap((m) => (m.endsWith("2") ? [m[0], m[0]] : [m]));

    it("tracks it turn by turn without crying wolf", () => {
      const target = applyMoves(SOLVED, WCA);
      const start = run([{ type: "scramble", scramble: WCA, target, facelets: SOLVED }]);
      const done = turn(start, SOLVED, quarterTurns(WCA));

      expect(done.state.phase).toBe("ready");
      expect(done.state.wrongTurns).toBe(0);
      expect(done.state.remaining).toEqual([]);
    });

    it("expands half turns in the hint", () => {
      const target = applyMoves(SOLVED, WCA);
      const state = run([{ type: "scramble", scramble: WCA, target, facelets: SOLVED }]);
      // First scramble move is R2, so the cube is asked for R, then R again.
      expect(state.remaining.slice(0, 3)).toEqual(["R", "R", "U'"]);
    });
  });

  describe("correcting a mistake", () => {
    it("names the turn that was wrong and how to undo it", () => {
      const state = run([scrambleEvent]);
      const wrong = turn(state, SOLVED, ["D"]);
      expect(wrong.state.wrongTurn).toEqual({ move: "D", undo: "D'" });
      expect(wrong.state.wrongTurns).toBe(1);
    });

    it("clears the warning once the mistake is undone, without counting it twice", () => {
      const state = run([scrambleEvent]);
      const wrong = turn(state, SOLVED, ["D"]);
      const fixed = turn(wrong.state, wrong.model, ["D'"]);
      expect(fixed.state.wrongTurn).toBeNull();
      expect(fixed.state.wrongTurns).toBe(1);
      // The hint picks up exactly where it was.
      expect(fixed.state.remaining[0]).toBe("R");
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

    it("starts on the first turn even when inspection was skipped", () => {
      // Reaching the scrambled state used to only arm a button, and turning from there was read
      // as disturbing the scramble — so someone who just started solving got no timer at all.
      const ready = turn(run([scrambleEvent]), SOLVED, splitMoves(SCRAMBLE));
      expect(ready.state.phase).toBe("ready");

      const solved = turn(ready.state, ready.model, splitMoves("F2 U R U' R'"), 7_000, 200);
      expect(solved.state.phase).toBe("solved");
      expect(solved.state.moves).toHaveLength(5);
      expect(solveTimeCs(solved.state)).toBe(80);
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

  describe("mixed clocks", () => {
    // Reproduces a real solve from 2026-11-06: Cross recorded as 0 ms across 21 moves and F2L 1's
    // recognition as 20,751,077 ms. When the cube loses a Bluetooth packet it re-sends the missed
    // moves with *no* timestamps, and the old code fell back to the browser's clock for just those
    // moves — a clock ~5.7 hours away from the cube's.
    const readyState = () => turn(run([scrambleEvent]), SOLVED, splitMoves(SCRAMBLE));
    const BROWSER_CLOCK = 20_751_077.1; // performance.now() on a tab open for hours

    it("never mixes the browser clock into a cube-timed solve", () => {
      const ready = readyState();
      let state = ready.state;
      let model = ready.model;
      const solution = splitMoves("F2 U R U' R'");
      solution.forEach((move, i) => {
        model = applyMove(model, move);
        // Move 2 is a recovered move: no cube timestamp, stamped with the browser clock instead.
        const recovered = i === 2;
        state = reduceSolve(state, {
          type: "move",
          move,
          cubeTs: recovered ? null : 1_000 + i * 200,
          localTs: BROWSER_CLOCK + i * 200,
          after: model,
        });
      });

      expect(state.phase).toBe("solved");
      expect(state.timingSource).toBe("cube");
      const ts = state.moves.map((m) => m.t);
      // Every time stays inside the solve and in order — no move 5.7 hours away.
      for (const t of ts) {
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(800);
      }
      expect([...ts].sort((a, b) => a - b)).toEqual(ts);
      expect(solveTimeCs(state)).toBe(80);
    });

    it("keeps the solve time right when the last move is the recovered one", () => {
      const ready = readyState();
      let state = ready.state;
      let model = ready.model;
      const solution = splitMoves("F2 U R U' R'");
      solution.forEach((move, i) => {
        model = applyMove(model, move);
        const last = i === solution.length - 1;
        state = reduceSolve(state, {
          type: "move",
          move,
          cubeTs: last ? null : 1_000 + i * 200,
          localTs: BROWSER_CLOCK + i * 200,
          after: model,
        });
      });
      expect(state.phase).toBe("solved");
      // The recovered final move can't be timed, so it is placed at the last known time rather than
      // hours later — the time under-reads by at most one move's gap, never by hours.
      expect(solveTimeCs(state)).toBe(60);
    });
  });

  describe("confidence", () => {
    const solvingState = () => {
      const ready = turn(run([scrambleEvent]), SOLVED, splitMoves(SCRAMBLE));
      return turn(ready.state, ready.model, ["F2"], 0);
    };

    it("does not distrust a solve because the cube sent a snapshot that agrees", () => {
      // The cube sends state snapshots routinely. Flagging on every one marked all three of the
      // first real solves as unreliable, which made the flag meaningless.
      const { state, model } = solvingState();
      const next = reduceSolve(state, { type: "facelets", facelets: model, localTs: 5_000 });
      expect(next.resynced).toBe(false);
    });

    it("does not distrust a solve over a snapshot that is merely behind a fast turn", () => {
      // A snapshot taken just before the latest move arrives disagrees for a moment. That's
      // latency, not a missed move; the connection store applies the same quiet-period rule.
      const { state } = solvingState();
      const next = reduceSolve(state, { type: "facelets", facelets: SOLVED, localTs: 100 });
      expect(next.resynced).toBe(false);
    });

    it("distrusts a solve when a settled snapshot disagrees", () => {
      const { state } = solvingState();
      const next = reduceSolve(state, { type: "facelets", facelets: SOLVED, localTs: 5_000 });
      expect(next.resynced).toBe(true);
    });
  });

  it("flags a solve whose state had to be corrected mid-way", () => {
    const ready = turn(run([scrambleEvent]), SOLVED, splitMoves(SCRAMBLE));
    let state = reduceSolve(ready.state, { type: "startInspection", now: 0 });
    const partial = turn(state, ready.model, ["F2"], 0);
    // Settled (well past the quiet period) and disagreeing: the model says F2 was applied, the
    // cube says solved. That is a genuine missed move.
    state = reduceSolve(partial.state, { type: "facelets", facelets: SOLVED, localTs: 5_000 });
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
