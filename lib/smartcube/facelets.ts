/**
 * Brand-agnostic 3x3 cube state as a 54-char facelet string in Kociemba order (U R F D L B, 9
 * stickers each, row-major as seen looking at the face). This is the lingua franca between the
 * smart-cube drivers, the 3D view and solve analysis.
 *
 * Move permutations are derived from sticker geometry rather than hand-written tables, so the same
 * geometry also tells the 3D renderer where each sticker sits.
 *
 * Axes: +x = R, +y = U, +z = F. Cubie coordinates are in {-1, 0, 1}.
 *
 * Note the deliberate name: `lib/scrambleCube.ts` also exports a `FACES`, but in a *different*
 * order (U D F B L R) for rendering. Importing the wrong one would silently transpose the cube, so
 * this one is `KOCIEMBA_FACES` and callers have to be explicit about which they mean.
 */

export const KOCIEMBA_FACES = ["U", "R", "F", "D", "L", "B"] as const;
export type FaceLetter = (typeof KOCIEMBA_FACES)[number];
export const SOLVED = KOCIEMBA_FACES.map((f) => f.repeat(9)).join("");

export type Vec3 = readonly [number, number, number];

export const FACE_NORMAL: Record<FaceLetter, Vec3> = {
  U: [0, 1, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  B: [0, 0, -1],
};

/** Cubie position of sticker (row, col) on a face, following Kociemba's viewing conventions. */
function stickerPosition(face: FaceLetter, r: number, c: number): Vec3 {
  switch (face) {
    case "U":
      return [c - 1, 1, r - 1]; // viewed from above, B at top
    case "R":
      return [1, 1 - r, 1 - c]; // viewed from the right, U at top
    case "F":
      return [c - 1, 1 - r, 1];
    case "D":
      return [c - 1, -1, 1 - r]; // viewed from below, F at top
    case "L":
      return [-1, 1 - r, c - 1];
    case "B":
      return [1 - c, 1 - r, -1];
  }
}

export type Sticker = { index: number; face: FaceLetter; pos: Vec3; normal: Vec3 };

export const STICKERS: readonly Sticker[] = KOCIEMBA_FACES.flatMap((face, fi) =>
  Array.from({ length: 9 }, (_, i) => ({
    index: fi * 9 + i,
    face,
    pos: stickerPosition(face, Math.floor(i / 3), i % 3),
    normal: FACE_NORMAL[face],
  }))
);

const keyOf = (pos: Vec3, n: Vec3) => `${pos.join(",")}|${n.join(",")}`;
const STICKER_BY_KEY = new Map(STICKERS.map((s) => [keyOf(s.pos, s.normal), s.index]));

/** Rotate v by quarter turns q (positive = counter-clockwise looking from +axis toward origin). */
export function rotate(v: Vec3, axis: 0 | 1 | 2, q: number): Vec3 {
  let [x, y, z] = v;
  for (let i = 0; i < ((q % 4) + 4) % 4; i++) {
    if (axis === 0) [y, z] = [-z, y];
    else if (axis === 1) [z, x] = [-x, z];
    else [x, y] = [-y, x];
  }
  return [x, y, z];
}

export type ParsedMove = {
  face: FaceLetter;
  axis: 0 | 1 | 2;
  layer: 1 | -1;
  /** Clockwise quarter turns: 1, 2 or -1. */
  turns: 1 | 2 | -1;
};

const MOVE_RE = /^([URFDLB])(2|')?$/;

export function parseMove(m: string): ParsedMove {
  const match = MOVE_RE.exec(m.trim());
  if (!match) throw new Error(`Unsupported move "${m}"`);
  const face = match[1] as FaceLetter;
  const n = FACE_NORMAL[face];
  const axis = (n[0] ? 0 : n[1] ? 1 : 2) as 0 | 1 | 2;
  const layer = n[axis] as 1 | -1;
  const turns = match[2] === "2" ? 2 : match[2] === "'" ? -1 : 1;
  return { face, axis, layer, turns };
}

/**
 * Clockwise (viewed from outside the face) = negative rotation about the face's outward normal.
 * Returns the signed quarter turns about the positive axis, for both the permutation and the 3D view.
 */
export const axisQuarterTurns = (m: ParsedMove): number => -m.turns * m.layer;

const PERM_CACHE = new Map<string, Int8Array>();

/** perm[dest] = src: the sticker that ends up at `dest` after the move. */
export function movePermutation(move: string): Int8Array {
  const cached = PERM_CACHE.get(move);
  if (cached) return cached;
  const m = parseMove(move);
  const q = axisQuarterTurns(m);
  const perm = new Int8Array(54);
  for (const s of STICKERS) {
    if (s.pos[m.axis] !== m.layer) {
      perm[s.index] = s.index;
      continue;
    }
    const dest = STICKER_BY_KEY.get(keyOf(rotate(s.pos, m.axis, q), rotate(s.normal, m.axis, q)));
    if (dest === undefined) throw new Error("geometry bug");
    perm[dest] = s.index;
  }
  PERM_CACHE.set(move, perm);
  return perm;
}

export function applyMove(facelets: string, move: string): string {
  const perm = movePermutation(move);
  let out = "";
  for (let i = 0; i < 54; i++) out += facelets[perm[i]];
  return out;
}

export const splitMoves = (moves: string | string[]): string[] =>
  typeof moves === "string" ? moves.split(/\s+/).filter(Boolean) : moves;

/**
 * Rewrite a sequence into the quarter turns a cube actually reports: `R2` becomes `R R`.
 *
 * Smart cubes have no concept of a half turn — they send one event per 90°. Comparing a scramble
 * move-for-move against what the cube reports therefore requires expanding it first, or every
 * half turn in the scramble reads as a mistake.
 */
export const toQuarterTurns = (moves: string | string[]): string[] =>
  splitMoves(moves).flatMap((move) => {
    const parsed = parseMove(move);
    return parsed.turns === 2 ? [parsed.face, parsed.face] : [move];
  });

/** The move that undoes `move` — what to tell someone who turned the wrong way. */
export const invertMove = (move: string): string => {
  const parsed = parseMove(move);
  return parsed.turns === 2 ? move : parsed.turns === -1 ? parsed.face : `${parsed.face}'`;
};

export const applyMoves = (facelets: string, moves: string | string[]): string =>
  splitMoves(moves).reduce(applyMove, facelets);

export const isSolved = (f: string) => f === SOLVED;
