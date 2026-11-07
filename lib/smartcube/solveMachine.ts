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

import { SOLVED, applyMove, isSolved, parseMove, toQuarterTurns } from "./facelets";
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
  /**
   * The cube state after each quarter turn of the scramble: `path[k]` is where the cube should be
   * after `k` turns. Where the solver is is read off this by state, never tracked by counting moves.
   */
  path: string[];
  /**
   * Turns made since the cube left the path, merged per face (`R R` is one R2 entry), newest last.
   * Undoing them last-first walks back onto the path.
   */
  detour: Array<{ face: string; quarters: 1 | 2 | 3 }>;
  /** Times the solver left the path. Counted, never blocking. */
  wrongTurns: number;
  /** The most recent off-scramble turn and how to undo it, so the UI can offer a way back. */
  wrongTurn: { move: string; undo: string } | null;
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
  /** Cube state after the latest solve move, to check snapshots against. */
  model: string | null;
  /** Browser time of the latest solve move, for the snapshot quiet period. */
  lastMoveLocalTs: number | null;
  penalty: Penalty;
}

export const INITIAL_SOLVE: SolveState = {
  phase: "idle",
  scramble: null,
  target: null,
  remaining: [],
  path: [],
  detour: [],
  wrongTurns: 0,
  wrongTurn: null,
  moves: [],
  inspectionStartedAt: null,
  startTs: null,
  endTs: null,
  timingSource: "cube",
  resynced: false,
  model: null,
  lastMoveLocalTs: null,
  penalty: "none",
};

/**
 * A snapshot that disagrees with the model is only evidence of a missed move once turning has
 * settled; until then it is just a snapshot taken before the latest move arrived. The connection
 * store applies the same rule before overwriting its model.
 */
export const SNAPSHOT_QUIET_MS = 700;

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
        // Expanded so the hint lines up with what the cube reports, one event per 90°.
        remaining: toQuarterTurns(event.scramble),
        path: scramblePath(event.scramble),
        detour: [],
        wrongTurns: 0,
        wrongTurn: null,
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
          // route still ends up ready.
          if (event.after === state.target) {
            return { ...state, phase: "ready", remaining: [], detour: [], wrongTurn: null };
          }

          // Where the solver is comes from the cube's state, never from matching moves against the
          // hint. Move matching was wrong whenever the undo of a mistake was also the next scramble
          // move — turn U' where U was wanted, undo it with U, and the U counted as progress too.
          // The hint then ran one turn ahead of the cube, and a solver who obeyed it to the end
          // was one turn short of the scramble with no way to reach "ready". Reading position off
          // the state can't drift from the cube, and it also accepts any route back: R' R' where
          // the scramble said R2 lands on the path and is simply on track.
          const turns = toQuarterTurns(state.scramble ?? "");
          const at = state.path.lastIndexOf(event.after);
          if (at >= 0) {
            return { ...state, remaining: turns.slice(at), detour: [], wrongTurn: null };
          }

          // Off the path. Leaving it is one mistake however many turns the detour takes.
          const leaving = state.detour.length === 0;
          const detour = extendDetour(state.detour, event.move);
          const top = detour[detour.length - 1];
          return {
            ...state,
            detour,
            wrongTurns: leaving ? state.wrongTurns + 1 : state.wrongTurns,
            wrongTurn: top
              ? { move: notate(top.face, top.quarters), undo: notate(top.face, 4 - top.quarters) }
              : null,
          };
        }

        case "ready":
        case "inspecting":
        case "solving": {
          // The clock is chosen once, on the first move, and every later move is read from that
          // same clock. Choosing per move mixed the cube's clock with the browser's, which differ
          // by however long the tab has been open — hours, in practice. A GAN cube re-sends moves
          // lost over Bluetooth with no timestamp at all, so the per-move fallback fired on exactly
          // the moves that were already in trouble.
          const starting = state.phase !== "solving";
          const source = starting ? (event.cubeTs !== null ? "cube" : "local") : state.timingSource;
          const reading = source === "cube" ? event.cubeTs : event.localTs;
          const previousT = state.moves.length ? state.moves[state.moves.length - 1].t : 0;

          let start = state.startTs;
          let t: number;
          if (starting) {
            start = reading;
            t = 0;
          } else if (reading === null || start === null) {
            // A recovered move has no reading on the solve's clock. It happened somewhere between
            // the last timed move and now; placing it at the last known time keeps the stream in
            // order and costs at most one gap of precision, where any other clock costs hours.
            t = previousT;
          } else {
            // Never earlier than the move before: a reading that goes backwards is a clock glitch,
            // and a negative gap would turn into a negative step time downstream.
            t = Math.max(previousT, reading - start);
          }

          const moves = [...state.moves, { move: event.move, t }];
          const done = isSolved(event.after);
          return {
            ...state,
            phase: done ? "solved" : "solving",
            startTs: start,
            // Derived from the move times rather than read raw, so it is on the same clock by
            // construction and the solve time always equals the last move's time.
            endTs: done && start !== null ? start + t : null,
            timingSource: source,
            moves,
            model: event.after,
            lastMoveLocalTs: event.localTs,
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
      if (state.phase !== "solving" || state.resynced) return state;
      // A snapshot that matches is the cube agreeing with us — the normal case, not a warning.
      if (state.model === null || event.facelets === state.model) return state;
      // One taken mid-turn trails the latest move; only a settled disagreement means a lost move.
      const settled =
        state.lastMoveLocalTs === null || event.localTs - state.lastMoveLocalTs > SNAPSHOT_QUIET_MS;
      return settled ? { ...state, resynced: true } : state;
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

/** `path[k]`: the state after the first `k` quarter turns of the scramble, from solved. */
function scramblePath(scramble: string): string[] {
  const path = [SOLVED];
  for (const move of toQuarterTurns(scramble)) path.push(applyMove(path[path.length - 1], move));
  return path;
}

/**
 * Add a turn to the detour. A turn of the same face as the newest entry merges into it, so the
 * hint asks for one undo per face rather than one per quarter turn, and a turn that cancels the
 * entry out removes it.
 */
function extendDetour(
  detour: SolveState["detour"],
  move: string
): SolveState["detour"] {
  const { face, turns } = parseMove(move);
  const quarters = ((turns % 4) + 4) % 4;
  const top = detour[detour.length - 1];
  if (top && top.face === face) {
    const merged = (top.quarters + quarters) % 4;
    const rest = detour.slice(0, -1);
    return merged === 0 ? rest : [...rest, { face, quarters: merged as 1 | 2 | 3 }];
  }
  return [...detour, { face, quarters: quarters as 1 | 2 | 3 }];
}

/** Quarter turns clockwise, as notation: 1 is R, 2 is R2, 3 is R'. */
const notate = (face: string, quarters: number): string => {
  const q = ((quarters % 4) + 4) % 4;
  return q === 1 ? face : q === 2 ? `${face}2` : `${face}'`;
};
