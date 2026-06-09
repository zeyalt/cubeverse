export type Penalty = "none" | "plus2" | "dnf" | "dns";
export type EventFormat = "ao5" | "mo3" | "bo3" | "bo1";

export const DNF = -1 as const;

/** Returns effective centisecond time. DNF/DNS → -1. +2 → time_cs + 200. */
export function effectiveTime(time_cs: number, penalty: Penalty): number {
  if (penalty === "dnf" || penalty === "dns") return DNF;
  if (penalty === "plus2") return time_cs + 200;
  return time_cs;
}

/**
 * Ao5: drop best and worst, mean middle 3.
 * ≥2 DNFs → DNF. 1 DNF counts as worst (removed).
 * Input must be effective times (+2 already added, DNF = -1).
 */
export function ao5(times: readonly number[]): number {
  if (times.length !== 5) throw new Error("ao5 requires exactly 5 times");

  const dnfCount = times.filter((t) => t === DNF).length;
  if (dnfCount >= 2) return DNF;

  const sorted = [...times].sort((a, b) => {
    const av = a === DNF ? 2_147_483_647 : a;
    const bv = b === DNF ? 2_147_483_647 : b;
    return av - bv;
  });

  // Drop index 0 (best) and index 4 (worst), mean indices 1–3
  const sum = sorted[1] + sorted[2] + sorted[3];
  return Math.round(sum / 3);
}

/**
 * Mo3: mean of all 3. Any DNF → DNF.
 * Input must be effective times.
 */
export function mo3(times: readonly number[]): number {
  if (times.length !== 3) throw new Error("mo3 requires exactly 3 times");
  if (times.some((t) => t === DNF)) return DNF;
  const sum = times.reduce((a, b) => a + b, 0);
  return Math.round(sum / 3);
}

/**
 * Combined: 5 times → Ao5, 3 times → Mo3. Returns null otherwise.
 * Mirrors the SQL wca_average() function.
 */
export function wcaAverage(times: readonly number[]): number | null {
  if (times.length === 5) return ao5(times);
  if (times.length === 3) return mo3(times);
  return null;
}

/**
 * General average of N (N ≥ 3): drop best and worst, mean the rest.
 * Any DNF in the middle → DNF. Handles Ao12, Ao50, Ao100, etc.
 * For N=5, gives identical results to ao5().
 */
export function aoN(times: readonly number[]): number {
  const n = times.length;
  if (n < 3) throw new Error(`aoN requires at least 3 times, got ${n}`);

  const sorted = [...times].sort((a, b) => {
    const av = a === DNF ? 2_147_483_647 : a;
    const bv = b === DNF ? 2_147_483_647 : b;
    return av - bv;
  });

  const middle = sorted.slice(1, n - 1);
  if (middle.some((t) => t === DNF)) return DNF;
  const sum = middle.reduce((a, b) => a + b, 0);
  return Math.round(sum / middle.length);
}

/**
 * Format centiseconds as a display string.
 *   -1       → "DNF"
 *   1234     → "12.34"
 *   8345     → "1:23.45"
 */
export function formatCs(cs: number): string {
  if (cs < 0) return "DNF";

  const totalSecs = Math.floor(cs / 100);
  const centis = cs % 100;
  const cStr = centis.toString().padStart(2, "0");

  if (totalSecs < 60) {
    return `${totalSecs}.${cStr}`;
  }

  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}.${cStr}`;
}

/**
 * Parse a display string to centiseconds.
 *   "12.34"  → 1234
 *   "1:23.45"→ 8345
 *   "DNF" / "DNS" → -1
 */
export function parseToCs(display: string): number {
  const s = display.trim().toUpperCase();
  if (s === "DNF" || s === "DNS") return DNF;

  if (s.includes(":")) {
    const [minsPart, rest] = s.split(":");
    const [secsPart, centisPart = "00"] = rest.split(".");
    const mins = parseInt(minsPart, 10);
    const secs = parseInt(secsPart, 10);
    const centis = parseInt(centisPart.padEnd(2, "0").slice(0, 2), 10);
    return (mins * 60 + secs) * 100 + centis;
  }

  const [secsPart, centisPart = "00"] = s.split(".");
  const secs = parseInt(secsPart, 10);
  const centis = parseInt(centisPart.padEnd(2, "0").slice(0, 2), 10);
  return secs * 100 + centis;
}
