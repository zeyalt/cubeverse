import { describe, expect, it } from "vitest";
import {
  CLL_CASES,
  filteredCases,
  invertMove,
  normalizeProgress,
  pickPractisedCase,
  progressPercent,
  reverseAlgorithm,
} from "./cll";

describe("reverseAlgorithm", () => {
  it("inverts a Sune", () => {
    expect(reverseAlgorithm("R U R' U R U2 R'")).toBe("R U2 R' U' R U' R'");
  });

  it("keeps half-turns as half-turns", () => {
    expect(invertMove("U2")).toBe("U2");
    expect(invertMove("U2'")).toBe("U2");
  });
});

describe("normalizeProgress", () => {
  it("fills defaults for an empty payload", () => {
    const progress = normalizeProgress(null);
    expect(progress.globalTarget).toBe(10);
    expect(progress.cases.S1).toEqual({ count: 0, note: "", passed: false, easy: false });
    expect(progress.spinFamilies.Sune).toBe(true);
  });

  it("reads nested case progress and clamps the target", () => {
    const progress = normalizeProgress({
      globalTarget: 400,
      spinFamilies: { Sune: false },
      cases: { S1: { count: 4, note: "sledgehammer extra long note", passed: true, easy: true } },
    });
    expect(progress.globalTarget).toBe(200);
    expect(progress.spinFamilies.Sune).toBe(false);
    expect(progress.cases.S1.count).toBe(4);
    expect(progress.cases.S1.passed).toBe(true);
    expect(progress.cases.S1.note.length).toBeLessThanOrEqual(20);
  });

  it("accepts the standalone trainer's flat A1 aliases", () => {
    const progress = normalizeProgress({ A1: { count: 2, note: "", passed: false, easy: false } });
    expect(progress.cases.AS1.count).toBe(2);
  });
});

describe("filteredCases", () => {
  it("keeps easy unfinished cases when both filters are on", () => {
    const progress = normalizeProgress({
      cases: {
        S1: { count: 10, easy: true },
        AS1: { count: 1, easy: true },
        AS2: { count: 1, easy: false },
      },
    });
    const ids = filteredCases(progress, "Antisune", true, true).map((row) => row.id);
    expect(ids).toEqual(["AS1"]);
  });
});

describe("pickPractisedCase", () => {
  it("falls back to the full pool when nothing has reps", () => {
    const progress = normalizeProgress({});
    const pool = CLL_CASES.filter((row) => row.family === "H");
    expect(pickPractisedCase(pool, progress, () => 0)?.id).toBe("H1");
  });

  it("weights towards practised cases", () => {
    const progress = normalizeProgress({
      cases: { H4: { count: 9 } },
    });
    const pool = CLL_CASES.filter((row) => row.family === "H");
    expect(pickPractisedCase(pool, progress, () => 0.99)?.id).toBe("H4");
  });
});

describe("progressPercent", () => {
  it("caps at 100", () => {
    expect(progressPercent(12, 10)).toBe(100);
    expect(progressPercent(5, 10)).toBe(50);
  });
});
