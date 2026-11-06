import { describe, expect, it } from "vitest";
import {
  MAX_MOVES,
  decodeMoveStream,
  encodeMoveStream,
  timedFromNotation,
  type TimedMove,
} from "./moveStream";

const ALL_MOVES = "URFDLB".split("").flatMap((face) => ["", "'", "2"].map((s) => face + s));

describe("move stream encoding", () => {
  it("round-trips every move", () => {
    const moves: TimedMove[] = ALL_MOVES.map((move, i) => ({ move, t: i * 150 }));
    expect(decodeMoveStream(encodeMoveStream(moves))).toEqual(moves);
  });

  it("round-trips a realistic solve, quantised to centiseconds", () => {
    let t = 0;
    const moves: TimedMove[] = Array.from({ length: 60 }, (_, i) => {
      t += 80 + (i % 7) * 30;
      return { move: ALL_MOVES[i % ALL_MOVES.length], t: Math.round(t / 10) * 10 };
    });
    expect(decodeMoveStream(encodeMoveStream(moves))).toEqual(moves);
  });

  it("stays small — the reason this format exists", () => {
    const moves = timedFromNotation(Array(60).fill("R U R' U'").join(" "), 180);
    const bytes = encodeMoveStream(moves).length;
    const asJson = JSON.stringify(moves).length;
    expect(bytes / moves.length).toBeLessThan(7);
    expect(bytes).toBeLessThan(asJson / 4);
  });

  it("handles long pauses and an empty stream", () => {
    const moves: TimedMove[] = [
      { move: "R", t: 0 },
      { move: "U", t: 600_000 },
    ];
    expect(decodeMoveStream(encodeMoveStream(moves))).toEqual(moves);
    expect(encodeMoveStream([])).toBe("");
    expect(decodeMoveStream("")).toEqual([]);
    expect(decodeMoveStream("   ")).toEqual([]);
  });

  it("never lets time run backwards", () => {
    const decoded = decodeMoveStream(encodeMoveStream([
      { move: "R", t: 500 },
      { move: "U", t: 200 },
    ]));
    expect(decoded).not.toBeNull();
    expect(decoded![1].t).toBeGreaterThanOrEqual(decoded![0].t);
  });

  it("returns null for malformed input instead of throwing", () => {
    for (const bad of ["Z1", "A", "1A", "A-1", "A!", "AA1", "nonsense", "A1 Z2"]) {
      expect(decodeMoveStream(bad), `expected "${bad}" to decode to null`).toBeNull();
    }
    expect(decodeMoveStream(null)).toBeNull();
    expect(decodeMoveStream(undefined)).toBeNull();
  });

  it("refuses to encode a move it has no code for", () => {
    expect(() => encodeMoveStream([{ move: "M", t: 0 }])).toThrow(/Cannot encode/);
    expect(() => encodeMoveStream([{ move: "Rw'", t: 0 }])).toThrow(/Cannot encode/);
  });

  it("caps a runaway stream", () => {
    const moves = Array.from({ length: MAX_MOVES + 500 }, (_, i) => ({ move: "R", t: i * 100 }));
    expect(decodeMoveStream(encodeMoveStream(moves))!.length).toBe(MAX_MOVES);
  });
});
