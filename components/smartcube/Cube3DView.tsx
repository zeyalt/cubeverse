"use client";

import { useEffect, useRef } from "react";
import { Cube3D } from "./cube3d";
import { subscribeMoves } from "@/lib/smartcube/useSmartCube";

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
export default function Cube3DView({ facelets, className }: { facelets: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<Cube3D | null>(null);
  // Held in a ref so the mount effect never re-runs when the state changes.
  const initialFacelets = useRef(facelets);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const view = new Cube3D(container);
    view.setFacelets(initialFacelets.current);
    cubeRef.current = view;
    const unsubscribe = subscribeMoves((move, after) => view.queueMove(move, after));
    return () => {
      unsubscribe();
      view.dispose();
      cubeRef.current = null;
    };
  }, []);

  // Jumps (sync, reset, a fresh scramble) land here; moves do not. Skipped while an animation is
  // in flight so a snapshot can't cut a turn short.
  useEffect(() => {
    const view = cubeRef.current;
    if (view && !view.busy && view.displayed !== facelets) view.setFacelets(facelets);
  }, [facelets]);

  return <div ref={containerRef} className={className} />;
}
