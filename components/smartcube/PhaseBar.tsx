"use client";

import { phaseBarLayout } from "@/lib/smartcube/phaseBar";
import type { SolveAnalysis } from "@/lib/smartcube/analysis";
import type { TimedMove } from "@/lib/smartcube/moveStream";

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

/** Step colours. Hue carries the order, so the eye reads the bar left to right as a sequence. */
const STEP_COLOR: Record<string, string> = {
  cross: "#7c5cc4",
  f2l1: "#5a5ab8",
  f2l2: "#5068bd",
  f2l3: "#4a7cc0",
  f2l4: "#4490c2",
  oll: "#3fa5b4",
  pll: "#4bb08a",
};

const seconds = (ms: number) => (ms / 1000).toFixed(2);

export function PhaseBar({
  analysis,
  moves,
}: {
  analysis: SolveAnalysis | null;
  moves: readonly TimedMove[];
}) {
  const layout = phaseBarLayout(analysis, moves);
  if (!layout) return null;

  return (
    <div>
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
              backgroundColor: STEP_COLOR[segment.name] ?? "#5a5ab8",
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
                style={{ backgroundColor: STEP_COLOR[segment.name] ?? "#5a5ab8" }}
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
