"use client";

import { useCallback, useRef, useState } from "react";
import { DEFAULT_BAR_WIDTH_PX, phaseBarLayout } from "@/lib/smartcube/phaseBar";
import type { SolveAnalysis } from "@/lib/smartcube/analysis";
import type { TimedMove } from "@/lib/smartcube/moveStream";
import { STEP_COLOR } from "./palette";

/**
 * The solve as a single proportional bar: each CFOP step in its own colour, with hesitations drawn
 * darker inside.
 *
 * The dark gaps are the point. A time per step tells you where the time went; the gaps tell you
 * whether it went on thinking or on turning, which is the difference between drilling recognition
 * and drilling fingers.
 *
 * Labels that can't fit under their own segment drop to a legend row instead of overlapping — see
 * `lib/smartcube/phaseBar.ts`, where that decision is made and tested.
 */

const seconds = (ms: number) => (ms / 1000).toFixed(2);

export function PhaseBar({
  analysis,
  moves,
}: {
  analysis: SolveAnalysis | null;
  moves: readonly TimedMove[];
}) {
  // Labels are placed against the bar's real width, which isn't known until it's on screen.
  // A callback ref, so it attaches whenever the bar appears — including when it first rendered
  // nothing and an analysis arrived later.
  const [width, setWidth] = useState(DEFAULT_BAR_WIDTH_PX);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    observer.current = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.current.observe(el);
  }, []);

  const layout = phaseBarLayout(analysis, moves, width);
  if (!layout) return null;

  return (
    <div ref={ref}>
      {/* Times, above their own segment. Positioned by percentage so they track the bar at any width. */}
      <div className="relative h-4">
        {layout.segments
          .filter((s) => s.labelPlacement === "above")
          .map((segment) => (
            <span
              key={segment.name}
              className="absolute whitespace-nowrap text-[11px] font-bold tabular-nums text-token"
              style={{ left: `${segment.start * 100}%` }}
            >
              {seconds(segment.ms)}
            </span>
          ))}
      </div>

      <div
        className="relative flex h-2 overflow-hidden rounded-full"
        role="img"
        aria-label={layout.segments
          .map((s) => `${s.label} ${seconds(s.ms)} seconds`)
          .join(", ")}
      >
        {layout.segments.map((segment) => (
          <div
            key={segment.name}
            className="relative h-full"
            style={{
              width: `${segment.width * 100}%`,
              backgroundColor: STEP_COLOR[segment.name],
            }}
          />
        ))}
        {/* Pauses sit on top of the whole bar rather than inside each segment, because a pause
            between two steps belongs to neither and would be clipped by either. */}
        {layout.segments.flatMap((segment) =>
          segment.pauses.map((pause, i) => (
            <div
              key={`${segment.name}-${i}`}
              className="absolute top-0 h-full"
              style={{
                left: `${pause.start * 100}%`,
                width: `${pause.width * 100}%`,
                backgroundColor: "rgba(0, 0, 0, 0.45)",
              }}
            />
          ))
        )}
      </div>

      {/* Step names, under their own segment. */}
      <div className="relative mt-1.5 h-3.5">
        {layout.segments
          .filter((s) => s.labelPlacement === "above")
          .map((segment) => (
            <span
              key={segment.name}
              className="absolute whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.12em] text-token-muted"
              style={{ left: `${segment.start * 100}%` }}
            >
              {segment.label}
            </span>
          ))}
      </div>

      {layout.legend.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {layout.legend.map((segment) => (
            <span key={segment.name} className="flex items-center gap-1.5 text-[10px] text-token-muted">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: STEP_COLOR[segment.name] }}
              />
              <span className="font-bold uppercase tracking-wider">{segment.label}</span>
              <span className="tabular-nums">{seconds(segment.ms)}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
