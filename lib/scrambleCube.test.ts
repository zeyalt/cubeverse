import { describe, expect, it } from "vitest";
import {
  FACE_COLORS,
  applyNxnScramble,
  applyPyraminxScramble,
  applySkewbScramble,
  applySquare1Scramble,
  parseNxnMoves,
  previewFor,
  solvedCube,
} from "./scrambleCube";

function col(cube: ReturnType<typeof applyNxnScramble>, face: "U" | "F" | "R" | "D" | "L" | "B", c: number) {
  const n = cube.n;
  return Array.from({ length: n }, (_, r) => cube.faces[face][r * n + c]);
}

function row(cube: ReturnType<typeof applyNxnScramble>, face: "U" | "F" | "R" | "D" | "L" | "B", r: number) {
  const n = cube.n;
  return cube.faces[face].slice(r * n, r * n + n);
}

describe("parseNxnMoves", () => {
  it("parses face, wide, and prime turns", () => {
    expect(parseNxnMoves("R U' Fw2 Uw")).toEqual([
      { face: "R", layers: [0], turns: 1 },
      { face: "U", layers: [0], turns: 3 },
      { face: "F", layers: [0, 1], turns: 2 },
      { face: "U", layers: [0, 1], turns: 1 },
    ]);
  });
});

describe("3x3 turns", () => {
  it("leaves a solved cube unchanged", () => {
    expect(applyNxnScramble(3, "")).toEqual(solvedCube(3));
  });

  it("sends the F top row to red after U", () => {
    expect(row(applyNxnScramble(3, "U"), "F", 0)).toEqual([
      FACE_COLORS.R,
      FACE_COLORS.R,
      FACE_COLORS.R,
    ]);
    expect(row(applyNxnScramble(3, "U"), "L", 0)).toEqual([
      FACE_COLORS.F,
      FACE_COLORS.F,
      FACE_COLORS.F,
    ]);
  });

  it("sends the F right column to yellow after R", () => {
    expect(col(applyNxnScramble(3, "R"), "F", 2)).toEqual([
      FACE_COLORS.D,
      FACE_COLORS.D,
      FACE_COLORS.D,
    ]);
  });

  it("sends the U right column to green after R", () => {
    expect(col(applyNxnScramble(3, "R"), "U", 2)).toEqual([
      FACE_COLORS.F,
      FACE_COLORS.F,
      FACE_COLORS.F,
    ]);
  });

  it("sends the F left column to white after L", () => {
    expect(col(applyNxnScramble(3, "L"), "F", 0)).toEqual([
      FACE_COLORS.U,
      FACE_COLORS.U,
      FACE_COLORS.U,
    ]);
  });

  it("sends the F bottom row to orange after D", () => {
    expect(row(applyNxnScramble(3, "D"), "F", 2)).toEqual([
      FACE_COLORS.L,
      FACE_COLORS.L,
      FACE_COLORS.L,
    ]);
    expect(row(applyNxnScramble(3, "D"), "R", 2)).toEqual([
      FACE_COLORS.F,
      FACE_COLORS.F,
      FACE_COLORS.F,
    ]);
  });

  it("sends the U top row to red after B", () => {
    expect(row(applyNxnScramble(3, "B"), "U", 0)).toEqual([
      FACE_COLORS.R,
      FACE_COLORS.R,
      FACE_COLORS.R,
    ]);
  });

  it("sends the U bottom row to orange after F", () => {
    expect(row(applyNxnScramble(3, "F"), "U", 2)).toEqual([
      FACE_COLORS.L,
      FACE_COLORS.L,
      FACE_COLORS.L,
    ]);
  });

  it("rotates the U face clockwise so an F-stained bottom row moves to the left", () => {
    expect(col(applyNxnScramble(3, "F U"), "U", 0)).toEqual([
      FACE_COLORS.L,
      FACE_COLORS.L,
      FACE_COLORS.L,
    ]);
  });

  it("returns to solved after four quarter turns", () => {
    for (const move of ["U", "R", "F", "D", "L", "B"]) {
      expect(applyNxnScramble(3, `${move} ${move} ${move} ${move}`)).toEqual(solvedCube(3));
    }
  });

  it("returns to solved after the sexy move six times", () => {
    const sexy = Array.from({ length: 6 }, () => "R U R' U'").join(" ");
    expect(applyNxnScramble(3, sexy)).toEqual(solvedCube(3));
  });

  it("returns to solved after RF 105 times", () => {
    const scramble = Array.from({ length: 105 }, () => "R F").join(" ");
    expect(applyNxnScramble(3, scramble)).toEqual(solvedCube(3));
  });

  it("keeps 3x3 centers fixed", () => {
    const cube = applyNxnScramble(3, "R U R' U' F B L D");
    expect(cube.faces.U[4]).toBe(FACE_COLORS.U);
    expect(cube.faces.F[4]).toBe(FACE_COLORS.F);
    expect(cube.faces.R[4]).toBe(FACE_COLORS.R);
  });

  it("returns to solved after a scramble and its inverse", () => {
    const scramble = "B2 R' B2 L F2 D2 B2 F2 R U2 R' D2 U B' L D2 L' R2 F2 L' U'";
    const inverse = parseNxnMoves(scramble)
      .reverse()
      .map(({ face, turns }) => `${face}${turns === 1 ? "'" : turns === 2 ? "2" : ""}`)
      .join(" ");
    expect(applyNxnScramble(3, `${scramble} ${inverse}`)).toEqual(solvedCube(3));
  });
});

describe("previewFor", () => {
  it("includes all six faces of a 3x3 scramble", () => {
    const preview = previewFor("333", "R");
    expect(preview.kind).toBe("cube");
    if (preview.kind !== "cube") return;
    expect(preview.F.map((row) => row[2])).toEqual([FACE_COLORS.D, FACE_COLORS.D, FACE_COLORS.D]);
    expect(preview.U).toHaveLength(3);
    expect(preview.D).toHaveLength(3);
    expect(preview.L).toHaveLength(3);
    expect(preview.B).toHaveLength(3);
  });
});

describe("pyraminx", () => {
  it("renders four 9-sticker faces", () => {
    const preview = previewFor("pyram", "");
    expect(preview.kind).toBe("pyraminx");
    if (preview.kind !== "pyraminx") return;
    expect(preview.faces.F).toHaveLength(9);
    expect(preview.faces.R).toHaveLength(9);
    expect(preview.faces.L).toHaveLength(9);
    expect(preview.faces.D).toHaveLength(9);
    expect(new Set(preview.faces.F)).toEqual(new Set([FACE_COLORS.F]));
  });

  it("returns to solved after three U turns", () => {
    expect(applyPyraminxScramble("U U U")).toEqual(applyPyraminxScramble(""));
    expect(applyPyraminxScramble("u u u")).toEqual(applyPyraminxScramble(""));
  });

  it("twists only the U tip on a lowercase u", () => {
    const solved = applyPyraminxScramble("");
    const twisted = applyPyraminxScramble("u");
    expect(twisted.F[0]).not.toBe(solved.F[0]);
    expect(twisted.F.slice(1)).toEqual(solved.F.slice(1));
  });

  it("returns to solved after a scramble and its inverse", () => {
    const scramble = "R U L' u' B r";
    const inverse = "r' B' u L U' R'";
    expect(applyPyraminxScramble(`${scramble} ${inverse}`)).toEqual(applyPyraminxScramble(""));
  });
});

describe("skewb", () => {
  it("returns to solved after three R turns", () => {
    expect(applySkewbScramble("R R R")).toEqual(applySkewbScramble(""));
  });

  it("moves the U center on R", () => {
    const solved = applySkewbScramble("");
    const turned = applySkewbScramble("R");
    expect(turned.centers.U).not.toBe(solved.centers.U);
  });

  it("returns to solved after a scramble and its inverse", () => {
    const scramble = "R U L' B R'";
    const inverse = "R B' L U' R'";
    expect(applySkewbScramble(`${scramble} ${inverse}`)).toEqual(applySkewbScramble(""));
  });
});

describe("square-1", () => {
  const solved = applySquare1Scramble("");
  const invert = (scramble: string) =>
    [...scramble.matchAll(/\((-?\d+),\s*(-?\d+)\)|\//g)]
      .reverse()
      .map((m) => (m[0] === "/" ? "/" : `(${-Number(m[1])}, ${-Number(m[2])})`))
      .join(" ");
  // A "/" is only legal when no corner straddles the slice (slots 5|6 and 11|0).
  const sliceBlocked = (pieces: ReturnType<typeof applySquare1Scramble>["top"]) =>
    pieces.some((p) => p.kind === "corner" && (p.start === 5 || p.start === 11));

  it("starts in cube shape with white on top and yellow on the bottom", () => {
    expect(solved.top).toHaveLength(8);
    expect(solved.top.every((p) => p.face === FACE_COLORS.U)).toBe(true);
    expect(solved.bottom.every((p) => p.face === FACE_COLORS.D)).toBe(true);
    expect(solved.middleFlipped).toBe(false);
  });

  it("returns to solved after two slashes or a full layer turn", () => {
    expect(applySquare1Scramble("/ /")).toEqual(solved);
    expect(applySquare1Scramble("(6, 6) (6, 6)")).toEqual(solved);
  });

  it("swaps the right half of each layer on a slash", () => {
    const slashed = applySquare1Scramble("/");
    expect(slashed.middleFlipped).toBe(true);
    expect(slashed.top.filter((p) => p.face === FACE_COLORS.D)).toHaveLength(4);
    expect(slashed.bottom.filter((p) => p.face === FACE_COLORS.U)).toHaveLength(4);
  });

  it("keeps every slash of generated scrambles unblocked and inverts back to solved", async () => {
    const { Scrambow } = await import("scrambow");
    const scrambles = new Scrambow().setType("sq1").get(20).map((s: { scramble_string: string }) => s.scramble_string);
    for (const scramble of scrambles) {
      const slashes = [...scramble.matchAll(/\//g)];
      for (const slash of slashes) {
        const before = applySquare1Scramble(scramble.slice(0, slash.index));
        expect(sliceBlocked(before.top) || sliceBlocked(before.bottom)).toBe(false);
      }
      expect(applySquare1Scramble(`${scramble} ${invert(scramble)}`)).toEqual(solved);
    }
  }, 20_000); // random-state sq1 scrambles are slow to generate
});
