import { describe, it, expect } from "vitest";
import { currentAoN, practiceSummary } from "./practiceStats";
import { DNF } from "./cubing";

describe("currentAoN", () => {
  it("returns null when there are fewer than n solves", () => {
    expect(currentAoN([100, 200, 300, 400], 5)).toBeNull();
    expect(currentAoN([], 5)).toBeNull();
  });

  it("averages the middle 3 of exactly 5 solves", () => {
    // drop 100 and 500, mean of 200/300/400
    expect(currentAoN([100, 200, 300, 400, 500], 5)).toBe(300);
  });

  it("uses the tail window, not the head, when there are extra solves", () => {
    // Six solves: the last five are 200..600, so the ao5 is mean(300,400,500).
    // A head-window bug would average 200/300/400 and return 300.
    expect(currentAoN([100, 200, 300, 400, 500, 600], 5)).toBe(400);
  });

  it("treats a single DNF as the worst time, so it gets dropped", () => {
    expect(currentAoN([100, 200, 300, 400, DNF], 5)).toBe(300);
  });

  it("returns null when a DNF lands in the counted middle", () => {
    // Two DNFs: one is dropped as worst, the other stays in the middle.
    expect(currentAoN([100, 200, 300, DNF, DNF], 5)).toBeNull();
  });

  it("returns null when every solve is a DNF", () => {
    expect(currentAoN([DNF, DNF, DNF, DNF, DNF], 5)).toBeNull();
  });
});

describe("practiceSummary", () => {
  it("reports null averages until enough solves exist", () => {
    const s = practiceSummary([100, 200, 300, 400, 500]);
    expect(s.ao5).toBe(300);
    expect(s.ao12).toBeNull();
    expect(s.ao50).toBeNull();
    expect(s.ao100).toBeNull();
  });

  it("excludes DNFs from best but includes them in count", () => {
    const s = practiceSummary([500, DNF, 300, 400]);
    expect(s.best).toBe(300);
    expect(s.count).toBe(4);
  });

  it("reports a null best when every solve is a DNF", () => {
    const s = practiceSummary([DNF, DNF]);
    expect(s.best).toBeNull();
    expect(s.count).toBe(2);
  });

  it("handles an empty history", () => {
    expect(practiceSummary([])).toEqual({
      ao5: null, ao12: null, ao50: null, ao100: null, best: null, count: 0,
    });
  });

  it("computes ao100 from the last 100 of a longer history", () => {
    // 150 solves ascending 1..150. The last 100 are 51..150; dropping best (51)
    // and worst (150) leaves 52..149, whose mean is 100.5 -> rounds to 101.
    const times = Array.from({ length: 150 }, (_, i) => i + 1);
    expect(practiceSummary(times).ao100).toBe(101);
  });
});
