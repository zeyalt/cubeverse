import { describe, expect, it } from "vitest";
import { createGestureDetector, GESTURE_WINDOW_MS } from "./gestures";

/** Feed a sequence at a fixed cadence and collect whatever fired. */
const feed = (moves: string[], stepMs = 300) => {
  const detector = createGestureDetector();
  return moves.map((move, i) => detector.push(move, i * stepMs));
};

describe("cube gestures", () => {
  it("fires on four turns of the same face in the same direction", () => {
    expect(feed(["U", "U", "U", "U"])).toEqual([null, null, null, "U"]);
    expect(feed(["D", "D", "D", "D"])).toEqual([null, null, null, "D"]);
  });

  it("fires for either direction", () => {
    expect(feed(["U'", "U'", "U'", "U'"]).at(-1)).toBe("U");
  });

  it("ignores a mixed-direction run", () => {
    // U U U' U returns the face to where it started too, but it isn't the deliberate spin the
    // gesture is meant to recognise, and accepting it would make accidental fires likely.
    expect(feed(["U", "U", "U'", "U"])).toEqual([null, null, null, null]);
  });

  it("resets when another face interrupts", () => {
    expect(feed(["U", "U", "R", "U", "U"])).toEqual([null, null, null, null, null]);
  });

  it("only watches the faces it was given", () => {
    const detector = createGestureDetector(["U"]);
    expect(["D", "D", "D", "D"].map((m, i) => detector.push(m, i * 300))).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it("does not fire on four turns spread out over time", () => {
    // Someone idly turning U while reading the screen must not confirm a dialog.
    const detector = createGestureDetector();
    const slow = GESTURE_WINDOW_MS + 500;
    expect([0, 1, 2, 3].map((i) => detector.push("U", i * slow))).toEqual([null, null, null, null]);
  });

  it("slides the run rather than throwing it away", () => {
    // A slow turn, then four fast ones. The slow turn drops out of the window and the fast four
    // still fire — if the detector reset the whole run instead, the gesture would need a fifth
    // turn here, which feels broken to use.
    const detector = createGestureDetector();
    expect(detector.push("U", 0)).toBeNull();
    const base = GESTURE_WINDOW_MS + 100;
    expect(detector.push("U", base)).toBeNull();
    expect(detector.push("U", base + 100)).toBeNull();
    expect(detector.push("U", base + 200)).toBeNull();
    expect(detector.push("U", base + 300)).toBe("U");
  });

  it("will not fire when no four turns fit in the window together", () => {
    // Each consecutive gap is inside the window, but the four turns together span more than it:
    // slow, slow, then a quick pair is not a deliberate spin.
    const detector = createGestureDetector();
    expect(detector.push("U", 0)).toBeNull();
    expect(detector.push("U", 100)).toBeNull();
    expect(detector.push("U", 200)).toBeNull();
    expect(detector.push("U", GESTURE_WINDOW_MS + 100)).toBeNull();
    expect(detector.push("U", GESTURE_WINDOW_MS + 200)).toBeNull();
  });

  it("needs a fresh four after firing", () => {
    const detector = createGestureDetector();
    ["U", "U", "U", "U"].forEach((m, i) => detector.push(m, i * 200));
    // A fifth turn must not fire again off the back of the same spin.
    expect(detector.push("U", 1_000)).toBeNull();
  });

  it("treats a half turn as breaking the run rather than counting twice", () => {
    expect(feed(["U", "U", "U2", "U"])).toEqual([null, null, null, null]);
  });

  it("can be reset", () => {
    const detector = createGestureDetector();
    detector.push("U", 0);
    detector.push("U", 100);
    detector.reset();
    expect(detector.push("U", 200)).toBeNull();
    expect(detector.push("U", 300)).toBeNull();
    expect(detector.push("U", 400)).toBeNull();
    expect(detector.push("U", 500)).toBe("U");
  });
});
