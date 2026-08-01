"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { formatCs } from "@/lib/cubing";

export type TimerPhase =
  | "idle"
  | "holding"
  | "ready"
  | "inspecting"
  | "running"
  | "stopped";

export type Penalty = "none" | "plus2" | "dnf";

export interface TimerDisplayHandle {
  /** Write the running time straight to the DOM, bypassing React. */
  set(cs: number): void;
}

interface TimerDisplayProps {
  phase: TimerPhase;
  inspSec: number;
  penalty: Penalty;
  /** The stopped solve's time. Ignored while running. */
  finalCs: number;
}

/**
 * The big timer numerals.
 *
 * While a solve is running the time changes ~60 times a second. Holding that in
 * React state re-rendered the whole practice screen — scramble, preview, cube
 * picker, metrics — on every animation frame. Here the running value is pushed
 * imperatively to the text node instead, so a solve commits a handful of times
 * (phase changes) rather than hundreds.
 *
 * Every other phase stays declarative: they change at most once a second, and
 * the stopped display has to react to penalty toggles.
 */
export const TimerDisplay = forwardRef<TimerDisplayHandle, TimerDisplayProps>(
  function TimerDisplay({ phase, inspSec, penalty, finalCs }, ref) {
    const nodeRef = useRef<HTMLParagraphElement>(null);

    useImperativeHandle(ref, () => ({
      set(cs: number) {
        const node = nodeRef.current;
        // Guard on phase so a frame that lands after the timer stopped can't
        // overwrite the final time that React has just rendered.
        if (node) node.textContent = formatCs(cs);
      },
    }), []);

    let text: string;
    if (phase === "inspecting" || phase === "holding" || phase === "ready") {
      text = inspSec > 0 ? String(inspSec) : "+2";
    } else if (phase === "stopped") {
      text =
        penalty === "dnf"
          ? "DNF"
          : penalty === "plus2"
            ? formatCs(finalCs + 200) + "+"
            : formatCs(finalCs);
    } else if (phase === "running") {
      // Starting value only; the RAF loop takes over via set().
      text = formatCs(0);
    } else {
      text = "0.00";
    }

    return (
      <p
        ref={nodeRef}
        className="timer-display font-mono-time font-semibold leading-none tracking-tighter select-none transition-colors"
        style={{
          userSelect: "none",
          WebkitUserSelect: "none",
          // Red while still holding (keep holding), green once held long enough
          // that releasing will start the timer.
          color:
            phase === "ready" ? "#22C55E" : phase === "holding" ? "#EF4444" : undefined,
        }}
      >
        {text}
      </p>
    );
  }
);
