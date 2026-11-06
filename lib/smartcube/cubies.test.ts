import { describe, expect, it } from "vitest";
import { SOLVED, applyMove, applyMoves } from "./facelets";
import { InvalidCubeError, cornerSolved, edgeSolved, toCubies } from "./cubies";

const solvedState = () => toCubies(SOLVED);

describe("cubie view", () => {
  it("reads a solved cube as every piece home and untwisted", () => {
    const s = solvedState();
    expect(s.cp).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(s.ep).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(s.co.every((o) => o === 0)).toBe(true);
    expect(s.eo.every((o) => o === 0)).toBe(true);
    for (let i = 0; i < 8; i++) expect(cornerSolved(s, i)).toBe(true);
    for (let i = 0; i < 12; i++) expect(edgeSolved(s, i)).toBe(true);
  });

  it("keeps permutations valid for any scramble", () => {
    const scrambles = [
      "R", "U'", "F2",
      "R U R' U'",
      "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2",
      "B2 R' B2 L F2 D2 B2 F2 R U2 R' D2 U B' L D2 L' R2 F2 L' U'",
    ];
    for (const scramble of scrambles) {
      const s = toCubies(applyMoves(SOLVED, scramble));
      expect([...s.cp].sort((a, b) => a - b), scramble).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      expect([...s.ep].sort((a, b) => a - b), scramble).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      // Physical laws of the cube: total corner twist ≡ 0 (mod 3), total edge flip even.
      expect(s.co.reduce((a, b) => a + b, 0) % 3, `corner twist: ${scramble}`).toBe(0);
      expect(s.eo.reduce((a, b) => a + b, 0) % 2, `edge flip: ${scramble}`).toBe(0);
    }
  });

  it("tracks which pieces a single turn disturbs", () => {
    // U moves the four U-layer corners and edges and nothing else.
    const s = toCubies(applyMove(SOLVED, "U"));
    const movedCorners = [0, 1, 2, 3].filter((i) => !cornerSolved(s, i));
    const movedEdges = [0, 1, 2, 3].filter((i) => !edgeSolved(s, i));
    expect(movedCorners).toHaveLength(4);
    expect(movedEdges).toHaveLength(4);
    for (let i = 4; i < 8; i++) expect(cornerSolved(s, i)).toBe(true);
    for (let i = 4; i < 12; i++) expect(edgeSolved(s, i)).toBe(true);
  });

  it("detects a twisted corner, which U alone cannot produce", () => {
    // R U R' U' repeated twice twists two corners without moving anything else out of place.
    const s = toCubies(applyMoves(SOLVED, "R U R' U' ".repeat(2)));
    expect(s.co.some((o) => o !== 0)).toBe(true);
  });

  it("rejects impossible states rather than returning nonsense", () => {
    expect(() => toCubies("U".repeat(53))).toThrow(InvalidCubeError);
    // A corner slot showing three U stickers is not a real piece.
    const broken = SOLVED.split("");
    broken[9] = "U";
    broken[20] = "U";
    expect(() => toCubies(broken.join(""))).toThrow(InvalidCubeError);
  });
});
