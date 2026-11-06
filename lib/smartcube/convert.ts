/**
 * Bridge between the two cube representations in this repo.
 *
 *  - `lib/scrambleCube.ts` — `Cube = { n, faces: Record<Face, string[]> }` holding hex colours.
 *    Drives the 2D scramble preview and every non-3x3 puzzle.
 *  - `lib/smartcube/facelets.ts` — a 54-character string of face letters, Kociemba order.
 *    Speaks the language of the smart-cube hardware.
 *
 * The two use the *same* per-face sticker layout — `lib/scrambleCube.kociemba.test.ts` proves it by
 * slicing a Kociemba facelet array straight into `faces[...]` with no transpose — so converting is
 * index arithmetic plus a colour/letter lookup.
 *
 * Both directions throw rather than coerce. A silent mis-map here would make scramble verification
 * reject every correct turn, which is far harder to diagnose than an exception.
 */

import { FACE_COLORS, applyNxnScramble, solvedCube, type Cube, type Face } from "../scrambleCube";
import { KOCIEMBA_FACES, SOLVED, type FaceLetter } from "./facelets";

const LETTER_OF_COLOR = new Map<string, FaceLetter>(
  (Object.entries(FACE_COLORS) as [FaceLetter, string][]).map(([letter, color]) => [color, letter])
);

export class FaceletConversionError extends Error {}

/** `Cube` (3x3 only) → 54-character facelet string. */
export function toFacelets(cube: Cube): string {
  if (cube.n !== 3) throw new FaceletConversionError(`Only 3x3 converts to facelets, got ${cube.n}x${cube.n}`);
  let out = "";
  for (const face of KOCIEMBA_FACES) {
    const stickers = cube.faces[face as Face];
    if (!stickers || stickers.length !== 9) {
      throw new FaceletConversionError(`Face ${face} has ${stickers?.length ?? 0} stickers, expected 9`);
    }
    for (const color of stickers) {
      const letter = LETTER_OF_COLOR.get(color);
      if (!letter) throw new FaceletConversionError(`Unknown sticker colour "${color}" on face ${face}`);
      out += letter;
    }
  }
  return out;
}

/** 54-character facelet string → `Cube`, so smart-cube state can drive the existing 2D preview. */
export function toCube(facelets: string): Cube {
  if (facelets.length !== 54) {
    throw new FaceletConversionError(`Expected 54 facelets, got ${facelets.length}`);
  }
  const cube = solvedCube(3);
  KOCIEMBA_FACES.forEach((face, faceIndex) => {
    const stickers: string[] = [];
    for (let i = 0; i < 9; i++) {
      const letter = facelets[faceIndex * 9 + i] as FaceLetter;
      const color = FACE_COLORS[letter as Face];
      if (!color) throw new FaceletConversionError(`Unknown facelet letter "${letter}" at index ${faceIndex * 9 + i}`);
      stickers.push(color);
    }
    cube.faces[face as Face] = stickers;
  });
  return cube;
}

/**
 * The facelet state a solver should reach after applying `scramble` to a solved cube — the target
 * the smart-cube scramble check compares against.
 *
 * Deliberately routed through the existing, already-tested `applyNxnScramble` rather than
 * `applyMoves`, so the app has a single source of truth for what a scramble means and the smart
 * cube's own model stays an independent check on it.
 */
export const scrambledFacelets = (scramble: string): string => toFacelets(applyNxnScramble(3, scramble));

/** Sanity check: a well-formed state has nine of each letter and centres in place. */
export function isWellFormed(facelets: string): boolean {
  if (facelets.length !== 54) return false;
  const counts = new Map<string, number>();
  for (const letter of facelets) counts.set(letter, (counts.get(letter) ?? 0) + 1);
  if (KOCIEMBA_FACES.some((face) => counts.get(face) !== 9)) return false;
  return KOCIEMBA_FACES.every((face, i) => facelets[i * 9 + 4] === SOLVED[i * 9 + 4]);
}
