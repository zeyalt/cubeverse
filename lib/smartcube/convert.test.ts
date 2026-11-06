import { describe, expect, it } from "vitest";
import { FACE_COLORS, applyNxnScramble, solvedCube } from "../scrambleCube";
import { SOLVED, applyMoves } from "./facelets";
import { isWellFormed, scrambledFacelets, toCube, toFacelets } from "./convert";

/** Deterministic PRNG so a failure is reproducible from the seed alone. */
function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomScramble(random: () => number, length: number): string {
  const faces = "URFDLB".split("");
  const suffixes = ["", "'", "2"];
  const moves: string[] = [];
  let lastFace = "";
  while (moves.length < length) {
    const face = faces[Math.floor(random() * 6)];
    if (face === lastFace) continue;
    lastFace = face;
    moves.push(face + suffixes[Math.floor(random() * 3)]);
  }
  return moves.join(" ");
}

describe("facelet ⇄ Cube conversion", () => {
  it("round-trips the solved cube", () => {
    expect(toFacelets(solvedCube(3))).toBe(SOLVED);
    expect(toCube(SOLVED)).toEqual(solvedCube(3));
  });

  it("round-trips scrambled states in both directions", () => {
    const random = makeRandom(20261107);
    for (let i = 0; i < 100; i++) {
      const scramble = randomScramble(random, 20);
      const cube = applyNxnScramble(3, scramble);
      const facelets = toFacelets(cube);
      expect(toCube(facelets)).toEqual(cube);
      expect(toFacelets(toCube(facelets))).toBe(facelets);
    }
  });

  /**
   * The check that matters. `applyNxnScramble` turns strips of a sticker array; `applyMoves`
   * permutes facelets using tables derived from 3D sticker geometry. They were written
   * independently, so agreeing move-for-move is strong evidence both are right — and it is the
   * assumption scramble verification rests on.
   */
  it("agrees with the smart-cube move model on every scramble", () => {
    const fixed = [
      "U", "R", "F", "D", "L", "B",
      "U'", "R'", "F'", "D'", "L'", "B'",
      "U2", "R2", "F2", "D2", "L2", "B2",
      "R U R' U'",
      "B2 R' B2 L F2 D2",
      "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2",
    ];
    const random = makeRandom(7);
    const generated = Array.from({ length: 200 }, () => randomScramble(random, 25));

    for (const scramble of [...fixed, ...generated]) {
      expect(scrambledFacelets(scramble), `scramble: ${scramble}`).toBe(applyMoves(SOLVED, scramble));
    }
  });

  it("produces well-formed states", () => {
    const random = makeRandom(99);
    expect(isWellFormed(SOLVED)).toBe(true);
    for (let i = 0; i < 50; i++) {
      expect(isWellFormed(scrambledFacelets(randomScramble(random, 25)))).toBe(true);
    }
    expect(isWellFormed("UUU")).toBe(false);
    expect(isWellFormed("U".repeat(54))).toBe(false);
  });

  it("throws rather than guessing on bad input", () => {
    expect(() => toFacelets(solvedCube(2))).toThrow(/Only 3x3/);
    expect(() => toFacelets(solvedCube(4))).toThrow(/Only 3x3/);
    expect(() => toCube("U".repeat(53))).toThrow(/54 facelets/);
    expect(() => toCube("X".repeat(54))).toThrow(/Unknown facelet letter/);

    const bad = solvedCube(3);
    bad.faces.U[0] = "#123456";
    expect(() => toFacelets(bad)).toThrow(/Unknown sticker colour/);

    const short = solvedCube(3);
    short.faces.R = [FACE_COLORS.R];
    expect(() => toFacelets(short)).toThrow(/expected 9/);
  });
});
