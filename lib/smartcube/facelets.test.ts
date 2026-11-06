import { describe, expect, it } from "vitest";
import {
  KOCIEMBA_FACES,
  SOLVED,
  applyMove,
  applyMoves,
  isSolved,
  movePermutation,
  parseMove,
} from "./facelets";

/**
 * Ground truth captured from a real GAN i4 on 2026-11-07: the facelet snapshots the cube itself
 * reported, keyed by its serial counter, plus the moves it reported in between. If the
 * geometry-derived move tables are right, replaying the moves must reproduce every snapshot.
 */
const I4_SNAPSHOTS: Record<number, string> = {
  51: "UURUUUUUURRBRRDFRDFFFFFFRFLDDDRDBLDBLLLLLLBDFUBBBBBRLD",
  52: "RUUUUUUUUFFFRRDFRDLLLFFFRFLDDDRDBLDBUBBLLLBDFRRBBBBRLD",
  53: "UUUUUURUULLLRRDFRDUBBFFFRFLDDDRDBLDBRRBLLLBDFFFFBBBRLD",
  55: "UURUUUUUURRBRRDFRDFFFFFFRFLDDDRDBLDBLLLLLLBDFUBBBBBRLD",
  57: "FUULUULURUBBURDURDURBFFFLFFFRRRDBLDBRFFLLDBDDLLDBBBRLD",
  59: "UURUUUUUURRBRRDFRDFFFFFFRFLDDDRDBLDBLLLLLLBDFUBBBBBRLD",
  62: "UURUUUFLLURBURDURDRFFFFFLFFFRRRDBLDBLLDLLDBDDUBBBBBRLD",
  66: "UURUUULFLBRBBRDURDFRUFFURFFDDRRDBLDBFFDLLLBDFULLBBBRLD",
  72: "LFRUUUUUDLRURRBDDRFFFFFBRFBDDRRDBLDBBLLLLLBDFFRUUBBULD",
  79: "BUBUUFUURFRUBRDDRDFFUFFURFFDDLRDBLDBULLLLLBDFRRLBBBRLD",
  85: "UUBUUFUULFRURRBDDBRRDFFBRFBDDRRDBLDLFFFLLLBDFRLLUBBULD",
  87: "UURUUUUUURRBRRDFRDFFFFFFRFLDDDRDBLDBLLLLLLBDFUBBBBBRLD",
};
const I4_MOVES: Record<number, string> = {
  52: "U'",
  53: "U'",
  54: "U'",
  55: "U'",
  56: "F",
  57: "U",
  58: "U'",
  59: "F'",
  60: "F",
  61: "F'",
  62: "F",
  63: "F'",
  ...Object.fromEntries(
    "R U R' U' ".repeat(6).trim().split(" ").map((move, i) => [64 + i, move])
  ),
};

describe("facelet move model", () => {
  it("satisfies the group identities", () => {
    for (const face of KOCIEMBA_FACES) {
      expect(applyMoves(SOLVED, [face, face, face, face])).toBe(SOLVED);
      expect(applyMoves(SOLVED, `${face} ${face}'`)).toBe(SOLVED);
      expect(applyMove(SOLVED, `${face}2`)).toBe(applyMoves(SOLVED, [face, face]));
      expect(applyMove(SOLVED, face)).not.toBe(SOLVED);
    }
    // Two well-known cycle lengths: sexy move has order 6, (R U) has order 105.
    expect(applyMoves(SOLVED, "R U R' U' ".repeat(6))).toBe(SOLVED);
    expect(applyMoves(SOLVED, "R U ".repeat(105))).toBe(SOLVED);
    expect(applyMoves(SOLVED, "R U ".repeat(35))).not.toBe(SOLVED);
  });

  it("matches the known facelet string for R", () => {
    expect(applyMove(SOLVED, "R")).toBe("UUFUUFUUFRRRRRRRRRFFDFFDFFDDDBDDBDDBLLLLLLLLLUBBUBBUBB");
  });

  it("builds a bijection for every move, leaving centres fixed", () => {
    for (const face of KOCIEMBA_FACES) {
      for (const suffix of ["", "'", "2"]) {
        const perm = movePermutation(face + suffix);
        expect(new Set(perm).size, `${face}${suffix} is not a bijection`).toBe(54);
        for (let i = 0; i < 6; i++) expect(perm[i * 9 + 4]).toBe(i * 9 + 4);
      }
    }
  });

  it("rejects moves it cannot represent", () => {
    // Slice, wide and rotation moves are deliberately unsupported: the hardware never reports them.
    for (const bad of ["M", "u", "Rw", "x", "y2", "R3", "", "RR"]) {
      expect(() => parseMove(bad), `expected "${bad}" to throw`).toThrow();
    }
  });

  it("recognises the solved state", () => {
    expect(isSolved(SOLVED)).toBe(true);
    expect(isSolved(applyMove(SOLVED, "R"))).toBe(false);
  });

  it("replays a real GAN i4 session and matches every snapshot the cube reported", () => {
    let state = I4_SNAPSHOTS[51];
    let checked = 0;
    for (let serial = 52; serial <= 87; serial++) {
      state = applyMove(state, I4_MOVES[serial]);
      if (I4_SNAPSHOTS[serial]) {
        expect(state, `serial ${serial}`).toBe(I4_SNAPSHOTS[serial]);
        checked++;
      }
    }
    expect(checked).toBe(11);
  });
});
