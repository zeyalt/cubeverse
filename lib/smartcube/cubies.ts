/**
 * Cubie-level view of a facelet string: which physical piece sits in each slot, and how it is
 * twisted. Solve analysis asks piece-shaped questions ("is the white-green edge home?") that a flat
 * sticker array can't answer directly.
 *
 * The four tables below are the standard Kociemba layout maps. They were already present in
 * `lib/scrambleCube.kociemba.test.ts`; they live here now because analysis needs them at runtime,
 * and that test imports them from here so the two can never drift apart.
 */

import { KOCIEMBA_FACES, type FaceLetter } from "./facelets";

/** Facelet indices of each corner slot, in the order given by CORNER_COLOR. */
export const CORNER_FACELET = [
  [8, 9, 20],
  [6, 18, 38],
  [0, 36, 47],
  [2, 45, 11],
  [29, 26, 15],
  [27, 44, 24],
  [33, 53, 42],
  [35, 17, 51],
] as const;

/** Facelet indices of each edge slot, in the order given by EDGE_COLOR. */
export const EDGE_FACELET = [
  [5, 10],
  [7, 19],
  [3, 37],
  [1, 46],
  [32, 16],
  [28, 25],
  [30, 43],
  [34, 52],
  [23, 12],
  [21, 41],
  [50, 39],
  [48, 14],
] as const;

/** Face letters of each corner piece, in its canonical (untwisted) sticker order. */
export const CORNER_COLOR = [
  ["U", "R", "F"],
  ["U", "F", "L"],
  ["U", "L", "B"],
  ["U", "B", "R"],
  ["D", "F", "R"],
  ["D", "L", "F"],
  ["D", "B", "L"],
  ["D", "R", "B"],
] as const;

/** Face letters of each edge piece, in its canonical (unflipped) sticker order. */
export const EDGE_COLOR = [
  ["U", "R"],
  ["U", "F"],
  ["U", "L"],
  ["U", "B"],
  ["D", "R"],
  ["D", "F"],
  ["D", "L"],
  ["D", "B"],
  ["F", "R"],
  ["F", "L"],
  ["B", "L"],
  ["B", "R"],
] as const;

export const CORNER_NAMES = CORNER_COLOR.map((c) => c.join("")) as readonly string[];
export const EDGE_NAMES = EDGE_COLOR.map((c) => c.join("")) as readonly string[];

/**
 * Which piece occupies each slot, and its twist.
 *
 * `cp[slot]` / `ep[slot]` is the index of the piece sitting there; `co`/`eo` is its orientation
 * (corners 0-2, edges 0-1). A solved cube has every `cp[i] === i` with zero orientation.
 */
export type CubieState = {
  cp: number[];
  co: number[];
  ep: number[];
  eo: number[];
};

/** Pieces are identified by their sticker set, independent of how they are twisted. */
const sortedKey = (letters: readonly string[]) => [...letters].sort().join("");

const CORNER_BY_KEY = new Map(CORNER_COLOR.map((c, i) => [sortedKey(c), i]));
const EDGE_BY_KEY = new Map(EDGE_COLOR.map((c, i) => [sortedKey(c), i]));

export class InvalidCubeError extends Error {}

/**
 * Read a facelet string as pieces. Throws `InvalidCubeError` if a slot holds a sticker triple that
 * is not a real piece — which happens when a move stream has drifted from the physical cube, so
 * callers in the analysis path must catch it and degrade rather than crash.
 */
export function toCubies(facelets: string): CubieState {
  if (facelets.length !== 54) throw new InvalidCubeError(`Expected 54 facelets, got ${facelets.length}`);

  const cp: number[] = [];
  const co: number[] = [];
  for (const slot of CORNER_FACELET) {
    const letters = slot.map((i) => facelets[i]);
    const piece = CORNER_BY_KEY.get(sortedKey(letters));
    if (piece === undefined) throw new InvalidCubeError(`No corner piece with stickers ${letters.join("")}`);
    // Orientation = how far the piece's canonical first sticker (U or D) sits from this slot's
    // first facelet.
    const twist = letters.findIndex((l) => l === "U" || l === "D");
    if (twist < 0) throw new InvalidCubeError(`Corner ${letters.join("")} has no U/D sticker`);
    cp.push(piece);
    co.push(twist);
  }

  const ep: number[] = [];
  const eo: number[] = [];
  for (const slot of EDGE_FACELET) {
    const letters = slot.map((i) => facelets[i]);
    const piece = EDGE_BY_KEY.get(sortedKey(letters));
    if (piece === undefined) throw new InvalidCubeError(`No edge piece with stickers ${letters.join("")}`);
    // An edge is "flipped" when its canonical first sticker is not on the slot's first facelet.
    ep.push(piece);
    eo.push(letters[0] === EDGE_COLOR[piece][0] ? 0 : 1);
  }

  return { cp, co, ep, eo };
}

/** The centre sticker of each face, which fixes the cube's orientation. */
export const centreOf = (facelets: string, face: FaceLetter): string =>
  facelets[KOCIEMBA_FACES.indexOf(face) * 9 + 4];

/** True when the piece in `slot` is both home and untwisted. */
export const cornerSolved = (s: CubieState, slot: number) => s.cp[slot] === slot && s.co[slot] === 0;
export const edgeSolved = (s: CubieState, slot: number) => s.ep[slot] === slot && s.eo[slot] === 0;
