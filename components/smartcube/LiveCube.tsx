"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Crosshair } from "lucide-react";
import { TabLoading } from "@/components/kid/lazyTabs";
import { recalibrateOrientation, useSmartCube } from "@/lib/smartcube/useSmartCube";

/**
 * The live cube: the 3D view, floating, and following the physical cube's orientation when the
 * cube streams it.
 *
 * "Floating" is literal: no box behind it, and a soft shadow underneath, so it reads as an object
 * held in the air — which is what it is, once it turns as you turn the real one.
 */
const Cube3DView = dynamic(() => import("./Cube3DView"), {
  ssr: false,
  loading: () => <TabLoading />,
});

/**
 * How long to wait for an orientation packet before saying the cube doesn't send them. A cube that
 * has a gyro starts streaming within a second of connecting; a few seconds' grace covers a slow
 * handshake without leaving the question open for long.
 */
const NO_GYRO_AFTER_MS = 6_000;

export function LiveCube() {
  const cube = useSmartCube();
  return (
    <>
      {/* The shadow sits below the cube's centre, on the "floor", and stays still while the cube
          turns above it — which is what makes it read as floating. */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[6%] left-1/2 h-[12%] w-[46%] -translate-x-1/2 rounded-[50%] bg-black/35 blur-xl"
      />
      <Cube3DView facelets={cube.facelets} calibration={cube.calibration} className="absolute inset-0" />
    </>
  );
}

/**
 * The orientation hint and Recalibrate, shown *below* the cube rather than over it. A cube steered
 * by the gyro can reach any part of its frame, so anything drawn inside the frame ends up on top of
 * it at some angle — it did, on the first real phone, sitting over the bottom row of stickers.
 */
export function CubeOrientationControls() {
  const cube = useSmartCube();
  if (cube.status !== "connected") return null;
  return <OrientationStatus live={cube.orientationLive} />;
}

function OrientationStatus({ live }: { live: boolean }) {
  const [waitedOut, setWaitedOut] = useState(false);
  useEffect(() => {
    if (live) return;
    const id = setTimeout(() => setWaitedOut(true), NO_GYRO_AFTER_MS);
    return () => clearTimeout(id);
  }, [live]);

  if (live) {
    return (
      <div className="mt-2 flex items-center justify-between gap-3">
        {/* The gyro has no compass, so "which way is the screen?" has to be answered once: the
            instruction sits beside the button it explains. */}
        <p id="recalibrate-hint" className="min-w-0 text-xs leading-snug text-token-muted">
          Hold white up, green facing you, then recalibrate.
        </p>
        <button
          onClick={recalibrateOrientation}
          aria-describedby="recalibrate-hint"
          className="flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-token px-3.5 text-xs font-bold text-token hover:bg-surface-strong"
        >
          <Crosshair className="size-3.5" />
          Recalibrate
        </button>
      </div>
    );
  }

  if (!waitedOut) return null;
  return (
    <p className="mt-2 text-center text-xs text-token-muted">
      This cube isn&apos;t sending its orientation, so the view stays put. Drag it to look around.
    </p>
  );
}
