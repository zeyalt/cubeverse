/**
 * Solve reconstruction: split a stream of timed moves into CFOP steps and work out where the time
 * actually went.
 *
 * The interesting number isn't total time, it's the split between *recognition* — the pause before
 * a step's first move, while the solver works out what to do — and *execution*, the turning
 * itself. Those two improve in completely different ways, and a solver can't tell them apart by
 * feel.
 *
 * Pure and dependency-free, so it can be tested against recorded solves without a browser.
 *
 * Honest limits, surfaced rather than papered over:
 *  - The hardware reports face turns only. Whole-cube rotations (x, y, z) and regrips are
 *    invisible, so "move count" means face turns and rotation habits can't be measured.
 *  - Detection assumes CFOP. Anything else returns `method: "unknown"` with the totals still
 *    filled in, rather than inventing step boundaries that aren't there.
 */

import { applyMove, isSolved, KOCIEMBA_FACES, type FaceLetter } from "./facelets";
import { CORNER_COLOR, EDGE_COLOR, InvalidCubeError, toCubies, type CubieState } from "./cubies";
import type { TimedMove } from "./moveStream";

export type StepName = "cross" | "f2l1" | "f2l2" | "f2l3" | "f2l4" | "oll" | "pll";

export interface SolveStep {
  name: StepName;
  /** Human label, e.g. "F2L 2" or "Cross". */
  label: string;
  /** Index of this step's first and last move within the solve. */
  startIndex: number;
  endIndex: number;
  /** Pause before the first move of the step — thinking time. */
  recognitionMs: number;
  /** First move to last move — turning time. */
  executionMs: number;
  moveCount: number;
  tps: number;
  /** Mid-step hesitations over PAUSE_MS, a better signal than the split alone. */
  pauseCount: number;
}

export interface SolveAnalysis {
  method: "cfop" | "unknown";
  steps: SolveStep[];
  totalMs: number;
  moveCount: number;
  tps: number;
  pauseCount: number;
  /** Which colour went on the bottom, if a cross was found. */
  crossColor: FaceLetter | null;
  confidence: "high" | "low";
  /** Set when analysis gave up or is unreliable. Shown to the user, not swallowed. */
  reason?: string;
}

/** A gap longer than this counts as a hesitation rather than normal turning. */
export const PAUSE_MS = 300;

const STEP_LABELS: Record<StepName, string> = {
  cross: "Cross",
  f2l1: "F2L 1",
  f2l2: "F2L 2",
  f2l3: "F2L 3",
  f2l4: "F2L 4",
  oll: "OLL",
  pll: "PLL",
};

/**
 * The four bottom-layer edge slots and the four F2L slot pairs, for each possible cross colour.
 * Indices refer to CORNER_COLOR / EDGE_COLOR in `cubies.ts`.
 */
type Orientation = {
  color: FaceLetter;
  /** Edge slots forming the cross. */
  crossEdges: number[];
  /** The four [cornerSlot, edgeSlot] pairs of the first two layers. */
  slots: Array<[number, number]>;
  /** Last-layer corner and edge slots. */
  llCorners: number[];
  llEdges: number[];
};

/** Faces adjacent to a given face — the four side colours around a cross. */
const OPPOSITE: Record<FaceLetter, FaceLetter> = { U: "D", D: "U", R: "L", L: "R", F: "B", B: "F" };

function buildOrientation(color: FaceLetter): Orientation {
  const opposite = OPPOSITE[color];
  const crossEdges: number[] = [];
  EDGE_COLOR.forEach((letters, slot) => {
    if ((letters as readonly string[]).includes(color)) crossEdges.push(slot);
  });
  const llEdges: number[] = [];
  EDGE_COLOR.forEach((letters, slot) => {
    if ((letters as readonly string[]).includes(opposite)) llEdges.push(slot);
  });
  const llCorners: number[] = [];
  CORNER_COLOR.forEach((letters, slot) => {
    if ((letters as readonly string[]).includes(opposite)) llCorners.push(slot);
  });

  // An F2L slot is a bottom corner plus the edge sharing both of its side colours.
  const slots: Array<[number, number]> = [];
  CORNER_COLOR.forEach((letters, cornerSlot) => {
    if (!(letters as readonly string[]).includes(color)) return;
    const sides = (letters as readonly string[]).filter((l) => l !== color);
    const edgeSlot = EDGE_COLOR.findIndex(
      (e) => sides.every((s) => (e as readonly string[]).includes(s))
    );
    if (edgeSlot >= 0) slots.push([cornerSlot, edgeSlot]);
  });

  return { color, crossEdges, slots, llCorners, llEdges };
}

const ORIENTATIONS: Orientation[] = KOCIEMBA_FACES.map(buildOrientation);

const cornerHome = (s: CubieState, slot: number) => s.cp[slot] === slot && s.co[slot] === 0;
const edgeHome = (s: CubieState, slot: number) => s.ep[slot] === slot && s.eo[slot] === 0;

const crossDone = (s: CubieState, o: Orientation) => o.crossEdges.every((e) => edgeHome(s, e));
const slotsDone = (s: CubieState, o: Orientation) =>
  o.slots.filter(([c, e]) => cornerHome(s, c) && edgeHome(s, e)).length;

/** OLL is finished when every last-layer piece is oriented, regardless of permutation. */
const ollDone = (s: CubieState, o: Orientation) =>
  o.llCorners.every((c) => s.co[c] === 0) && o.llEdges.every((e) => s.eo[e] === 0);

function makeStep(
  name: StepName,
  moves: TimedMove[],
  startIndex: number,
  endIndex: number,
  previousEndMs: number
): SolveStep {
  const first = moves[startIndex];
  const last = moves[endIndex];
  const executionMs = Math.max(0, last.t - first.t);
  const moveCount = endIndex - startIndex + 1;
  let pauseCount = 0;
  for (let i = startIndex + 1; i <= endIndex; i++) {
    if (moves[i].t - moves[i - 1].t > PAUSE_MS) pauseCount++;
  }
  return {
    name,
    label: STEP_LABELS[name],
    startIndex,
    endIndex,
    recognitionMs: Math.max(0, first.t - previousEndMs),
    executionMs,
    moveCount,
    tps: executionMs > 0 ? ((moveCount - 1) / executionMs) * 1000 : 0,
    pauseCount,
  };
}

function totals(moves: TimedMove[]) {
  const totalMs = moves.length ? moves[moves.length - 1].t - moves[0].t : 0;
  let pauseCount = 0;
  for (let i = 1; i < moves.length; i++) if (moves[i].t - moves[i - 1].t > PAUSE_MS) pauseCount++;
  return {
    totalMs,
    moveCount: moves.length,
    tps: totalMs > 0 ? ((moves.length - 1) / totalMs) * 1000 : 0,
    pauseCount,
  };
}

const giveUp = (moves: TimedMove[], reason: string): SolveAnalysis => ({
  method: "unknown",
  steps: [],
  ...totals(moves),
  crossColor: null,
  confidence: "low",
  reason,
});

/**
 * Analyse a solve.
 *
 * @param scrambled  Facelet state the solve started from.
 * @param moves      Solve moves, timestamped from the first move.
 */
export function analyseSolve(scrambled: string, moves: readonly TimedMove[]): SolveAnalysis {
  const list = [...moves];
  if (list.length === 0) return giveUp(list, "No moves were recorded.");

  // Replay once, keeping the cubie view after every move.
  const states: CubieState[] = [];
  let facelets = scrambled;
  try {
    states.push(toCubies(facelets));
    for (const { move } of list) {
      facelets = applyMove(facelets, move);
      states.push(toCubies(facelets));
    }
  } catch (error) {
    if (error instanceof InvalidCubeError) return giveUp(list, "The move stream doesn't describe a valid cube.");
    throw error;
  }

  if (!isSolved(facelets)) return giveUp(list, "The solve doesn't end on a solved cube.");

  // Pick the cross colour whose cross completes earliest — this is how colour-neutral solving is
  // handled rather than assumed, and it fixes the orientation for every later test.
  let best: { orientation: Orientation; index: number } | null = null;
  for (const orientation of ORIENTATIONS) {
    const index = states.findIndex((s) => crossDone(s, orientation));
    if (index <= 0) continue;
    if (!best || index < best.index) best = { orientation, index };
  }
  if (!best) return giveUp(list, "No cross was completed, so this doesn't look like CFOP.");

  const { orientation } = best;

  /**
   * Boundaries are first occurrences, scanning forward from the previous one.
   *
   * It is tempting to demand that a milestone, once reached, stays true for the rest of the solve
   * — but that is simply not how cubing works. `R U R'` breaks the DR cross edge on its first move
   * and restores it on its last; a T-perm disturbs the cross throughout. Completed work is
   * routinely broken mid-algorithm and put back. The invariant holds at step *boundaries*, not
   * continuously.
   *
   * Requiring the earlier milestones to hold simultaneously is what keeps this honest: a pair that
   * flickers into place mid-algorithm almost always does so while the cross is disturbed, so the
   * conjunction rejects it.
   */
  const firstIndexFrom = (from: number, done: (s: CubieState) => boolean): number => {
    for (let i = from; i < states.length; i++) if (done(states[i])) return i;
    return -1;
  };

  const crossIndex = firstIndexFrom(1, (s) => crossDone(s, orientation));
  if (crossIndex <= 0) return giveUp(list, "The cross was never completed.");

  const slotIndices: number[] = [];
  let from = crossIndex + 1;
  for (let k = 1; k <= 4; k++) {
    const index = firstIndexFrom(
      from,
      (s) => crossDone(s, orientation) && slotsDone(s, orientation) >= k
    );
    if (index < 0) return giveUp(list, `Only ${k - 1} of the 4 F2L pairs were completed.`);
    slotIndices.push(index);
    // Not `index + 1`: two pairs can finish on the same move, and a pair can already be solved
    // when the cross lands. Those steps take no moves and are reported as skipped, not invented.
    from = index;
  }
  const f2lEnd = slotIndices[3];

  // Searching from `f2lEnd` inclusive is what distinguishes an OLL skip (already oriented the
  // moment F2L finished) from a real OLL step.
  const ollIndex = firstIndexFrom(
    f2lEnd,
    (s) => crossDone(s, orientation) && slotsDone(s, orientation) === 4 && ollDone(s, orientation)
  );
  const hasOll = ollIndex > f2lEnd;
  const pllIndex = states.length - 1;

  const boundaries: Array<{ name: StepName; end: number }> = [
    { name: "cross", end: crossIndex },
    { name: "f2l1", end: slotIndices[0] },
    { name: "f2l2", end: slotIndices[1] },
    { name: "f2l3", end: slotIndices[2] },
    { name: "f2l4", end: slotIndices[3] },
  ];
  // An OLL skip leaves no OLL moves at all; the same for PLL on a lucky last layer.
  if (hasOll) boundaries.push({ name: "oll", end: ollIndex });
  if (pllIndex > (hasOll ? ollIndex : f2lEnd)) boundaries.push({ name: "pll", end: pllIndex });

  const steps: SolveStep[] = [];
  let cursor = 0;
  let previousEndMs = 0;
  for (const { name, end } of boundaries) {
    // `states[i]` is the state *before* move i, so a boundary at state index `end` closes after
    // move `end - 1`.
    const endMove = end - 1;
    if (endMove < cursor) continue; // step took no moves (a skip)
    steps.push(makeStep(name, list, cursor, endMove, previousEndMs));
    previousEndMs = list[endMove].t;
    cursor = endMove + 1;
  }

  if (steps.length < 3) return giveUp(list, "Too few steps were detected to be a useful breakdown.");

  return {
    method: "cfop",
    steps,
    ...totals(list),
    crossColor: orientation.color,
    confidence: "high",
  };
}
