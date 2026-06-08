import { describe, it, expect } from "vitest";
import {
  DNF,
  effectiveTime,
  ao5,
  mo3,
  wcaAverage,
  formatCs,
  parseToCs,
} from "./cubing";

// ─── Six required cases from the spec (§0) ───────────────────────────────────

describe("ao5 — clean", () => {
  it("drops best and worst, means middle 3", () => {
    // sorted: [1000, 1100, 1200, 1300, 1400] → drop 1000+1400 → mean(1100,1200,1300)=1200
    expect(ao5([1000, 1100, 1200, 1300, 1400])).toBe(1200);
  });
});

describe("ao5 — one +2", () => {
  it("treats the +2 as a regular effective time", () => {
    // raw: [900, 1000, 1100, 1300, 1400]; one has +2 applied → effective: [900, 1200, 1100, 1300, 1400]
    // sorted: [900, 1100, 1200, 1300, 1400] → drop 900+1400 → mean(1100,1200,1300)=1200
    const effective = [
      effectiveTime(900, "none"),
      effectiveTime(1000, "plus2"), // 1200
      effectiveTime(1100, "none"),
      effectiveTime(1300, "none"),
      effectiveTime(1400, "none"),
    ];
    expect(ao5(effective)).toBe(1200);
  });
});

describe("ao5 — one DNF", () => {
  it("counts DNF as worst; averages remaining middle 3", () => {
    // sorted: [1000, 1200, 1300, 1400, DNF(∞)] → drop 1000+DNF → mean(1200,1300,1400)=1300
    expect(ao5([1000, DNF, 1200, 1300, 1400])).toBe(1300);
  });
});

describe("ao5 — two DNFs", () => {
  it("returns DNF when ≥2 attempts are DNF", () => {
    expect(ao5([1000, DNF, DNF, 1300, 1400])).toBe(DNF);
  });
});

describe("mo3 — clean", () => {
  it("means all three times", () => {
    // mean(1000, 1100, 1200) = 1100
    expect(mo3([1000, 1100, 1200])).toBe(1100);
  });
});

describe("mo3 — one DNF", () => {
  it("returns DNF when any attempt is DNF", () => {
    expect(mo3([1000, DNF, 1200])).toBe(DNF);
  });
});

// ─── effectiveTime ────────────────────────────────────────────────────────────

describe("effectiveTime", () => {
  it("none → unchanged", () => expect(effectiveTime(1234, "none")).toBe(1234));
  it("plus2 → +200", () => expect(effectiveTime(1234, "plus2")).toBe(1434));
  it("dnf → -1", () => expect(effectiveTime(1234, "dnf")).toBe(DNF));
  it("dns → -1", () => expect(effectiveTime(1234, "dns")).toBe(DNF));
});

// ─── wcaAverage ───────────────────────────────────────────────────────────────

describe("wcaAverage", () => {
  it("delegates 5-element arrays to ao5", () => {
    expect(wcaAverage([1000, 1100, 1200, 1300, 1400])).toBe(1200);
  });
  it("delegates 3-element arrays to mo3", () => {
    expect(wcaAverage([1000, 1100, 1200])).toBe(1100);
  });
  it("returns null for other lengths", () => {
    expect(wcaAverage([1000, 1100])).toBeNull();
    expect(wcaAverage([])).toBeNull();
  });
});

// ─── formatCs ────────────────────────────────────────────────────────────────

describe("formatCs", () => {
  it("DNF (-1) → 'DNF'", () => expect(formatCs(-1)).toBe("DNF"));
  it("sub-minute → 'ss.cc'", () => expect(formatCs(1379)).toBe("13.79"));
  it("exactly 1 min → '1:00.00'", () => expect(formatCs(6000)).toBe("1:00.00"));
  it("over 1 min → 'm:ss.cc'", () => expect(formatCs(7012)).toBe("1:10.12"));
  it("zero centis pad → '12.00'", () => expect(formatCs(1200)).toBe("12.00"));
  it("single-digit centis pad → '12.04'", () => expect(formatCs(1204)).toBe("12.04"));
});

// ─── parseToCs ───────────────────────────────────────────────────────────────

describe("parseToCs", () => {
  it('"DNF" → -1', () => expect(parseToCs("DNF")).toBe(DNF));
  it('"DNS" → -1', () => expect(parseToCs("DNS")).toBe(DNF));
  it('"13.79" → 1379', () => expect(parseToCs("13.79")).toBe(1379));
  it('"1:10.12" → 7012', () => expect(parseToCs("1:10.12")).toBe(7012));
  it("round-trips formatCs", () => {
    expect(parseToCs(formatCs(8345))).toBe(8345);
    expect(parseToCs(formatCs(1379))).toBe(1379);
  });
});

// ─── Rounding edge cases ──────────────────────────────────────────────────────

describe("rounding", () => {
  it("ao5 rounds to nearest centisecond", () => {
    // mean(999, 1000, 1001) = 1000.0 → 1000
    expect(ao5([900, 999, 1000, 1001, 1100])).toBe(1000);
    // mean(1000, 1001, 1002) = 1001.0 → 1001
    expect(ao5([900, 1000, 1001, 1002, 1100])).toBe(1001);
  });
  it("mo3 rounds to nearest centisecond", () => {
    // mean(1000, 1001, 1002) = 1001.0 → 1001
    expect(mo3([1000, 1001, 1002])).toBe(1001);
    // mean(1000, 1000, 1001) = 1000.33… → 1000
    expect(mo3([1000, 1000, 1001])).toBe(1000);
    // mean(1001, 1001, 1001) = 1001
    expect(mo3([1001, 1001, 1001])).toBe(1001);
  });
});
