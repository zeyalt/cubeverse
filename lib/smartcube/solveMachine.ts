/**
 * The solve flow, as a pure reducer.
 *
 * Kept free of React and of the Bluetooth layer so the whole thing — scramble checking, inspection
 * penalties, auto start/stop, drift handling — can be driven by synthetic events in a plain node
 * test. The hook in `useSmartSolve.ts` is a thin wrapper that feeds it real cube events.
 *
 * Timing comes from the cube's own clock wherever possible. Measured against a GAN i4, it drifts
 * 14 ms over 92 s, while Bluetooth delivery jitters by ±40 ms — so cube timestamps are the more
 * honest source for splits, and the only one worth basing "where did the time go" on.
 */

import { isSolved, splitMoves } from "./facelets";
import type { TimedMove } from "./moveStream";

export type SolvePhase =
  /** No scramble yet, or the cube isn't ready. */
  | "idle"
  /** A scramble is shown; the solver is applying it to the cube. */
  | "scrambling"
  /** The cube's state matches the scramble. */
  | "ready"
  | "inspecting"
  | "solving"
  | "solved";

export type Penalty = "none" | "plus2" | "dnf";

export interface SolveState {
  phase: SolvePhase;
  scramble: string | null;
  /** Facelet state the cube must reach for the scramble to count as applied. */
  target: string | null;
  /** Scramble moves still to apply, for the "next move" hint. */
  remaining: string[];
  /** Turns that didn't match the hint. Counted, never blocking. */
  wrongTurns: number;
  /** Solve moves, timestamped from the first move of the solve. */
  moves: TimedMove[];
  /** Wall-clock ms when inspection began; null outside inspection. */
  inspectionStartedAt: number | null;
  /** Cube-clock timestamp of the first solve move. */
  startTs: number | null;
  endTs: number | null;
  timingSource: "cube" | "local";
  /**
   * The cube corrected our model mid-solve. The solve still counts, but its reconstruction may be
   * wrong, so it is saved with reduced confidence rather than silently trusted.
   */
  resynced: boolean;
  penalty: Penalty;
}

export const INITIAL_SOLVE: SolveState = {
  phase: "idle",
  scramble: null,
  target: null,
  remaining: [],
  wrongTurns: 0,
  moves: [],
  inspectionStartedAt: null,
  startTs: null,
  endTs: null,
  timingSource: "cube",
  resynced: false,
  penalty: "none",
};

/** WCA inspection: over 15 s is +2, over 17 s is a DNF. */
export const INSPECTION_LIMIT_MS = 15_000;
export const INSPECTION_DNF_MS = 17_000;

export type SolveEvent =
  | { type: "scramble"; scramble: string; target: string; facelets: string }
  /** `after` is the cube state once this move is applied — the caller already computed it. */
  | { type: "move"; move: string; cubeTs: number | null; localTs: number; after: string }
  /** A full-state snapshot from the cube, used to notice drift. */
  | { type: "facelets"; facelets: string; localTs: number }
  | { type: "startInspection"; now: number }
  | { type: "tick"; now: number }
  | { type: "penalty"; penalty: Penalty }
  | { type: "reset" };

export function reduceSolve(state: SolveState, event: SolveEvent): SolveState {
  switch (event.type) {
    case "reset":
      return { ...INITIAL_SOLVE };

    case "scramble":
      return {
        ...INITIAL_SOLVE,
        scramble: event.scramble,
        target: event.target,
        remaining: splitMoves(event.scramble),
        // Handing out a scramble the cube already matches (it happens) skips straight to ready.
        phase: event.facelets === event.target ? "ready" : "scrambling",
      };

    case "startInspection":
      if (state.phase !== "ready") return state;
      return { ...state, phase: "inspecting", inspectionStartedAt: event.now };

    case "tick": {
      if (state.phase !== "inspecting" || state.inspectionStartedAt === null) return state;
      const held = event.now - state.inspectionStartedAt;
      if (held >= INSPECTION_DNF_MS) return { ...state, phase: "solved", penalty: "dnf", endTs: state.startTs };
      if (held >= INSPECTION_LIMIT_MS && state.penalty === "none") return { ...state, penalty: "plus2" };
      return state;
    }

    case "penalty":
      return state.phase === "solved" ? { ...state, penalty: event.penalty } : state;

    case "move": {
      switch (state.phase) {
        case "scrambling": {
          // The target is a *state*, not a sequence: someone who turns wrongly and recovers by any
          // route still ends up ready. The pointer only drives the next-move hint.
          const expected = state.remaining[0];
          const matched = expected === event.move;
          return {
            ...state,
            remaining: matched ? state.remaining.slice(1) : state.remaining,
            wrongTurns: matched ? state.wrongTurns : state.wrongTurns + 1,
            phase: event.after === state.target ? "ready" : "scrambling",
            // Reaching the target clears the hint list however it was reached.
            ...(event.after === state.target ? { remaining: [] } : {}),
          };
        }

        case "ready":
          // Turning again after reaching the target means the scramble is being disturbed.
          return event.after === state.target
            ? state
            : { ...state, phase: "scrambling", remaining: [], wrongTurns: state.wrongTurns + 1 };

        case "inspecting":
        case "solving": {
          const usingCube = event.cubeTs !== null;
          const ts = event.cubeTs ?? event.localTs;
          const starting = state.phase === "inspecting";
          const start = starting ? ts : state.startTs;
          const t = starting ? 0 : ts - (start ?? ts);
          const moves = [...state.moves, { move: event.move, t }];
          const done = isSolved(event.after);
          return {
            ...state,
            phase: done ? "solved" : "solving",
            startTs: start,
            endTs: done ? ts : null,
            timingSource: starting ? (usingCube ? "cube" : "local") : state.timingSource,
            moves,
            inspectionStartedAt: null,
          };
        }

        default:
          return state;
      }
    }

    case "facelets": {
      // Only meaningful mid-solve: a snapshot that disagrees means a move was missed, so the
      // reconstruction can't be fully trusted even though the solve itself still counts.
      if (state.phase !== "solving") return state;
      return state.resynced ? state : { ...state, resynced: true };
    }

    default:
      return state;
  }
}

/** Raw solve duration in ms, before penalties. */
export function solveDurationMs(state: SolveState): number | null {
  if (state.startTs === null || state.endTs === null) return null;
  return Math.max(0, state.endTs - state.startTs);
}

/** Final time in centiseconds, with the +2 applied. DNF returns null. */
export function solveTimeCs(state: SolveState): number | null {
  if (state.penalty === "dnf") return null;
  const ms = solveDurationMs(state);
  if (ms === null) return null;
  return Math.round(ms / 10) + (state.penalty === "plus2" ? 200 : 0);
}

/** Turns per second across the solve. */
export function solveTps(state: SolveState): number | null {
  const ms = solveDurationMs(state);
  if (!ms || state.moves.length < 2) return null;
  return (state.moves.length / ms) * 1000;
}
