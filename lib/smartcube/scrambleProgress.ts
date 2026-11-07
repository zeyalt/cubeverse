/**
 * The scramble as the solver reads it — `R2`, not `R R` — with how far through it they are.
 *
 * The scramble checker has to work in quarter turns, because that is all a smart cube reports:
 * `R2` arrives as two separate R events. But nobody writes or reads scrambles that way, so the
 * display folds the quarter turns back into the scramble's own moves. A half turn that is half
 * done stays on screen as the current move, marked as needing one more quarter.
 */

import { splitMoves, parseMove } from "./facelets";

export interface ScrambleStep {
  /** As written in the scramble: R, R', R2. */
  move: string;
  state: "done" | "current" | "todo";
  /** A half turn with one of its two quarters already made. */
  halfDone: boolean;
}

/** `appliedQuarterTurns`: how many of the scramble's quarter turns the cube has completed. */
export function scrambleProgress(scramble: string, appliedQuarterTurns: number): ScrambleStep[] {
  let start = 0;
  let currentFound = false;
  return splitMoves(scramble).map((move) => {
    const quarters = parseMove(move).turns === 2 ? 2 : 1;
    const end = start + quarters;
    const done = appliedQuarterTurns >= end;
    const current = !done && !currentFound;
    if (current) currentFound = true;
    const step: ScrambleStep = {
      move,
      state: done ? "done" : current ? "current" : "todo",
      halfDone: current && quarters === 2 && appliedQuarterTurns === start + 1,
    };
    start = end;
    return step;
  });
}
