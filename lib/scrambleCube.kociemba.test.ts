import { describe, expect, it } from "vitest";
import { FACE_COLORS, applyNxnScramble, type Face } from "./scrambleCube";
import {
  CORNER_COLOR,
  CORNER_FACELET,
  EDGE_COLOR,
  EDGE_FACELET,
} from "./smartcube/cubies";

/**
 * Kociemba corner/edge move tables ("replaced by"). The facelet layout maps they pair with now
 * live in `lib/smartcube/cubies.ts`, because solve analysis needs them at runtime — importing them
 * here keeps this cross-check honest about the same tables the app actually uses.
 */
const CP = {
  U: [3, 0, 1, 2, 4, 5, 6, 7],
  R: [4, 1, 2, 0, 7, 5, 6, 3],
  F: [1, 5, 2, 3, 0, 4, 6, 7],
  D: [0, 1, 2, 3, 5, 6, 7, 4],
  L: [0, 2, 6, 3, 4, 1, 5, 7],
  B: [0, 1, 3, 7, 4, 5, 2, 6],
} as const;
const CO = {
  U: [0, 0, 0, 0, 0, 0, 0, 0],
  R: [2, 0, 0, 1, 1, 0, 0, 2],
  F: [1, 2, 0, 0, 2, 1, 0, 0],
  D: [0, 0, 0, 0, 0, 0, 0, 0],
  L: [0, 1, 2, 0, 0, 2, 1, 0],
  B: [0, 0, 1, 2, 0, 0, 2, 1],
} as const;
const EP = {
  U: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11],
  R: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0],
  F: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11],
  D: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11],
  L: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11],
  B: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7],
} as const;
const EO = {
  U: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  R: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  F: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0],
  D: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  L: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  B: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1],
} as const;


type Cubie = { cp: number[]; co: number[]; ep: number[]; eo: number[] };

function identity(): Cubie {
  return {
    cp: [0, 1, 2, 3, 4, 5, 6, 7],
    co: [0, 0, 0, 0, 0, 0, 0, 0],
    ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  };
}

function multiply(a: Cubie, face: keyof typeof CP): Cubie {
  const cp = Array(8);
  const co = Array(8);
  const ep = Array(12);
  const eo = Array(12);
  for (let c = 0; c < 8; c++) {
    cp[c] = a.cp[CP[face][c]];
    let ori = a.co[CP[face][c]] + CO[face][c];
    if (ori >= 3) ori -= 3;
    co[c] = ori;
  }
  for (let e = 0; e < 12; e++) {
    ep[e] = a.ep[EP[face][e]];
    eo[e] = (EO[face][e] + a.eo[EP[face][e]]) % 2;
  }
  return { cp, co, ep, eo };
}

function facelets(cube: Cubie): string[] {
  const f = Array<string>(54).fill("");
  for (let i = 0; i < 6; i++) f[9 * i + 4] = "URFDLB"[i];
  for (let i = 0; i < 8; i++) {
    const j = cube.cp[i];
    const ori = cube.co[i];
    for (let k = 0; k < 3; k++) f[CORNER_FACELET[i][(k + ori) % 3]] = CORNER_COLOR[j][k];
  }
  for (let i = 0; i < 12; i++) {
    const j = cube.ep[i];
    const ori = cube.eo[i];
    for (let k = 0; k < 2; k++) f[EDGE_FACELET[i][(k + ori) % 2]] = EDGE_COLOR[j][k];
  }
  return f;
}

const FACE_ORDER: Face[] = ["U", "R", "F", "D", "L", "B"];

function kociembaPreview(scramble: string) {
  let cube = identity();
  for (const move of scramble.split(/\s+/).filter(Boolean)) {
    const face = move[0] as keyof typeof CP;
    const turns = move.endsWith("'") ? 3 : move.endsWith("2") ? 2 : 1;
    for (let i = 0; i < turns; i++) cube = multiply(cube, face);
  }
  const colors = facelets(cube);
  const out = {} as Record<Face, string[]>;
  FACE_ORDER.forEach((face, index) => {
    out[face] = colors.slice(index * 9, index * 9 + 9).map((letter) => FACE_COLORS[letter as Face]);
  });
  return out;
}

function dump(label: string, faces: Record<Face, string[]>) {
  return FACE_ORDER.map((face) => `${label}.${face}=${faces[face].join(",")}`).join("\n");
}

describe("3x3 vs Kociemba", () => {
  const scrambles = [
    "U", "R", "F", "D", "L", "B",
    "U'", "R2", "B2",
    "R B", "U B", "B R", "F B", "B U", "D B", "B D",
    "R L", "U L", "F L", "L F", "L U", "L D",
    "R U R' U'",
    "B2 R'",
    "B2 R' B2",
    "B2 R' B2 L F2 D2",
    "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2",
    "B2 R' B2 L F2 D2 B2 F2 R U2 R' D2 U B' L D2 L' R2 F2 L' U'",
  ];
  for (const scramble of scrambles) {
    it(`matches ${scramble}`, () => {
      const ours = applyNxnScramble(3, scramble).faces;
      const ref = kociembaPreview(scramble);
      for (const face of FACE_ORDER) {
        expect(ours[face], dump("ours", ours) + "\n" + dump("ref", ref)).toEqual(ref[face]);
      }
    });
  }
});
