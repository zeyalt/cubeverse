"use client";

import { useEffect, useRef } from "react";
import { Cube3D } from "./cube3d";
import { subscribeEvents, subscribeMoves } from "@/lib/smartcube/useSmartCube";
import { OrientationTracker, fromGan } from "@/lib/smartcube/orientation";

/**
 * React wrapper around the imperative `Cube3D` renderer.
 *
 * Moves are fed straight from the store's move channel into the renderer, never through React
 * state: a fast solve is ~10 moves a second, and a re-render per move would drop frames mid-turn
 * for no benefit. React only owns the container element's lifetime.
 *
 * This module is the one that pulls in three.js, so it is always loaded via `dynamic()` with
 * `ssr: false` — it is imported only after the user chooses to connect.
 */
export default function Cube3DView({
  facelets,
  calibration = 0,
  className,
}: {
  facelets: string;
  /** Changes when the solver taps Recalibrate; the current position becomes home. */
  calibration?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<Cube3D | null>(null);
  const trackerRef = useRef(new OrientationTracker());
  // Held in a ref so the mount effect never re-runs when the state changes.
  const initialFacelets = useRef(facelets);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const view = new Cube3D(container);
    view.setFacelets(initialFacelets.current);
    cubeRef.current = view;
    const unsubscribe = subscribeMoves((move, after) => view.queueMove(move, after));
    // Orientation goes straight from the cube to the renderer, like moves: tens of packets a
    // second, none of which should cost a React render.
    const tracker = trackerRef.current;
    let following = false;
    const unsubscribeGyro = subscribeEvents((event) => {
      if (event.type !== "gyro") return;
      if (!following) {
        following = true;
        view.setFollowing(true);
      }
      view.setOrientation(tracker.update(fromGan(event.quaternion)));
    });
    return () => {
      unsubscribe();
      unsubscribeGyro();
      view.dispose();
      cubeRef.current = null;
    };
  }, []);

  // Recalibrate: wherever the cube is now becomes home, and the drawn cube eases back to it.
  // Skipped on mount (calibration 0) — the first gyro reading calibrates by itself.
  useEffect(() => {
    if (calibration === 0) return;
    cubeRef.current?.setOrientation(trackerRef.current.recalibrate());
  }, [calibration]);

  // Jumps (sync, reset, a fresh scramble) land here; moves do not. Skipped while an animation is
  // in flight so a snapshot can't cut a turn short.
  useEffect(() => {
    const view = cubeRef.current;
    if (view && !view.busy && view.displayed !== facelets) view.setFacelets(facelets);
  }, [facelets]);

  return <div ref={containerRef} className={className} />;
}
