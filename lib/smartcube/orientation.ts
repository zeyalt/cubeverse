/**
 * Turning a smart cube's gyro readings into how to draw the cube on screen.
 *
 * Pure quaternion arithmetic, no three.js, so it can be tested in node. The renderer only smooths
 * towards whatever this produces.
 *
 * **Why calibration exists.** The cube's gyro has no compass. Its quaternion is relative to an
 * arbitrary frame fixed when the cube woke up, and nothing in it says which way the screen faces.
 * So one reading is taken as "the cube is in the home position" — white on top, green facing you —
 * and every later reading is drawn relative to it. That reference is the basis. It is taken from
 * the first reading automatically, and again whenever the solver taps Recalibrate.
 *
 * **Why `basis × current`, not `current × basis`.** With the gyro reporting body→world, the
 * cube's orientation *relative to the screen* is (screen←world)(world←body) = q₀⁻¹·q, where q₀ is
 * the reading taken while the cube's axes lined up with the screen's. The other order expresses the
 * rotation in the gyro's arbitrary world frame, which would make the drawn cube turn about the wrong
 * axes as soon as it was held at any angle.
 */

/** [x, y, z, w]. */
export type Quat = readonly [number, number, number, number];

export const IDENTITY: Quat = [0, 0, 0, 1];

export function normalize([x, y, z, w]: Quat): Quat {
  const n = Math.hypot(x, y, z, w);
  // A zero quaternion is a corrupt packet, not an orientation. Drawing nothing would be worse than
  // holding still, so it reads as "no rotation".
  return n > 1e-9 ? [x / n, y / n, z / n, w / n] : IDENTITY;
}

export const conjugate = ([x, y, z, w]: Quat): Quat => [-x, -y, -z, w];

/** Hamilton product a·b: rotate by b, then by a. */
export function multiply([ax, ay, az, aw]: Quat, [bx, by, bz, bw]: Quat): Quat {
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/**
 * GAN's sensor axes, rearranged into the app's: +x towards R, +y towards U, +z towards F.
 *
 * GAN's frame has its vertical on z and its depth on y, flipped; this is the mapping the
 * `gan-web-bluetooth` sample app uses. **It is the one assumption here not yet checked against a
 * physical cube.** If the drawn cube tips forward when you turn it sideways, this line is wrong,
 * and nothing else in this file needs to change.
 */
export function fromGan(q: { x: number; y: number; z: number; w: number }): Quat {
  return normalize([q.x, q.z, -q.y, q.w]);
}

/**
 * Remembers the home reading and turns each new reading into an on-screen orientation.
 *
 * Stateful by necessity — calibration is a remembered reading — but tiny, and the only place that
 * state lives.
 */
export class OrientationTracker {
  private basis: Quat | null = null;
  private latest: Quat | null = null;

  /** Feed a reading (already in app axes); returns the orientation to draw. */
  update(reading: Quat): Quat {
    const q = normalize(reading);
    this.latest = q;
    // The first reading becomes home, so the cube starts out drawn the way it always has been.
    if (!this.basis) this.basis = conjugate(q);
    return normalize(multiply(this.basis, q));
  }

  /**
   * Treat the current position as home. Returns the orientation to draw now — identity, unless no
   * reading has arrived yet.
   */
  recalibrate(): Quat {
    this.basis = this.latest ? conjugate(this.latest) : null;
    return IDENTITY;
  }

  get calibrated(): boolean {
    return this.basis !== null;
  }
}

/** Rotate a vector by a unit quaternion — for tests, and for anything that wants to check a pose. */
export function rotateVector(q: Quat, [vx, vy, vz]: readonly [number, number, number]): [number, number, number] {
  const [x, y, z] = multiply(multiply(q, [vx, vy, vz, 0]), conjugate(q));
  return [x, y, z];
}

/** Quaternion for a rotation of `radians` about a unit `axis`. */
export function fromAxisAngle(axis: readonly [number, number, number], radians: number): Quat {
  const s = Math.sin(radians / 2);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(radians / 2)];
}
