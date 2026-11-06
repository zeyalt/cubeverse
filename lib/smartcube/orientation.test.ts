import { describe, expect, it } from "vitest";
import {
  IDENTITY,
  OrientationTracker,
  fromAxisAngle,
  fromGan,
  multiply,
  normalize,
  rotateVector,
  type Quat,
} from "./orientation";

const X: [number, number, number] = [1, 0, 0];
const Y: [number, number, number] = [0, 1, 0];
const Z: [number, number, number] = [0, 0, 1];

/** Two quaternions describe the same rotation if they are equal or exact opposites. */
function expectSameRotation(a: Quat, b: Quat) {
  const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  expect(dot).toBeCloseTo(1, 6);
}

/**
 * A gyro with no compass reports orientation in some frame fixed when it woke up. This is that
 * frame's offset from the screen: deliberately lopsided, so a test can't pass by the frames
 * happening to line up.
 */
const GYRO_WORLD = normalize(multiply(fromAxisAngle(Y, 1.1), fromAxisAngle(X, -0.7)));
/** What the gyro reports when the cube's pose relative to the screen is `pose`. */
const reading = (pose: Quat) => multiply(GYRO_WORLD, pose);

describe("orientation tracking", () => {
  it("draws the home pose for the reading it was calibrated on", () => {
    const tracker = new OrientationTracker();
    expectSameRotation(tracker.update(reading(IDENTITY)), IDENTITY);
  });

  it("draws the cube's real pose, whatever frame the gyro woke up in", () => {
    // Calibrated in the home position, then tipped 90° towards the viewer about the screen's x
    // axis. The drawn cube must tip the same way, which only holds if the order is basis × reading.
    const tracker = new OrientationTracker();
    tracker.update(reading(IDENTITY));
    const tipped = fromAxisAngle(X, Math.PI / 2);
    expectSameRotation(tracker.update(reading(tipped)), tipped);
  });

  it("turns about the screen's vertical when the cube is spun on the table", () => {
    const tracker = new OrientationTracker();
    tracker.update(reading(IDENTITY));
    const shown = tracker.update(reading(fromAxisAngle(Y, Math.PI / 2)));
    // Spinning about vertical keeps the top face on top and carries the front face to the side.
    const up = rotateVector(shown, Y);
    const front = rotateVector(shown, Z);
    expect(up[1]).toBeCloseTo(1, 6);
    expect(front[0]).toBeCloseTo(1, 6);
  });

  it("composes: two turns in a row read as both turns", () => {
    const tracker = new OrientationTracker();
    tracker.update(reading(IDENTITY));
    const both = multiply(fromAxisAngle(Y, 0.6), fromAxisAngle(X, 0.4));
    expectSameRotation(tracker.update(reading(both)), both);
  });

  it("recalibrates to wherever the cube is now", () => {
    // Connected while holding the cube at an angle: everything is drawn off by that angle until
    // the solver holds it in the home position and taps Recalibrate.
    const tracker = new OrientationTracker();
    tracker.update(reading(fromAxisAngle(Z, 0.8))); // the awkward first reading becomes home
    tracker.update(reading(IDENTITY)); // now actually held in the home position
    expectSameRotation(tracker.recalibrate(), IDENTITY);
    expectSameRotation(tracker.update(reading(IDENTITY)), IDENTITY);
    const tipped = fromAxisAngle(X, 0.5);
    expectSameRotation(tracker.update(reading(tipped)), tipped);
  });

  it("is harmless to recalibrate before any reading", () => {
    const tracker = new OrientationTracker();
    expect(tracker.recalibrate()).toEqual(IDENTITY);
    expect(tracker.calibrated).toBe(false);
    tracker.update(reading(IDENTITY));
    expect(tracker.calibrated).toBe(true);
  });

  it("copes with readings that aren't quite unit length", () => {
    // Sixteen-bit packed components never normalise exactly.
    const tracker = new OrientationTracker();
    const q = tracker.update([0.001, 0.0, 0.0, 0.998]);
    expect(Math.hypot(...q)).toBeCloseTo(1, 9);
  });

  it("treats a zero quaternion as no rotation rather than NaN", () => {
    expect(normalize([0, 0, 0, 0])).toEqual(IDENTITY);
  });
});

describe("GAN axes", () => {
  it("rearranges GAN's sensor axes into the app's", () => {
    // A rotation about GAN's z axis (its vertical) becomes one about the app's y (towards U).
    const aboutGanZ = fromAxisAngle(Z, 0.9);
    const mapped = fromGan({ x: aboutGanZ[0], y: aboutGanZ[1], z: aboutGanZ[2], w: aboutGanZ[3] });
    expectSameRotation(mapped, fromAxisAngle(Y, 0.9));
  });

  it("always returns a unit quaternion", () => {
    const q = fromGan({ x: 0.5, y: 0.5, z: 0.5, w: 0.49 });
    expect(Math.hypot(...q)).toBeCloseTo(1, 9);
  });
});
