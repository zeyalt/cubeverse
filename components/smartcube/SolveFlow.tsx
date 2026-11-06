"use client";

import { Check, RefreshCw } from "lucide-react";
import { formatCs } from "@/lib/cubing";
import { INSPECTION_LIMIT_MS } from "@/lib/smartcube/solveMachine";
import type { SolveState } from "@/lib/smartcube/solveMachine";

/**
 * The top-of-tab panel that changes with the phase of a solve: scramble to apply, inspection
 * countdown, running timer, final time.
 *
 * Deliberately shows the *next* scramble move rather than the whole sequence in a wall of text —
 * the point of a smart cube is that the app knows where you are, so it can just tell you.
 */
export function SolveFlow({
  solve,
  inspectionMs,
  liveMs,
  onStartInspection,
  onNextScramble,
}: {
  solve: SolveState;
  inspectionMs: number;
  liveMs: number;
  onStartInspection: () => void;
  onNextScramble: () => void;
}) {
  const applied = solve.scramble
    ? solve.scramble.split(/\s+/).length - solve.remaining.length
    : 0;
  const total = solve.scramble ? solve.scramble.split(/\s+/).length : 0;

  if (solve.phase === "scrambling") {
    return (
      <div className="surface rounded-2xl p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-token-muted">
            Scramble
          </p>
          <button
            onClick={onNextScramble}
            className="flex items-center gap-1.5 text-xs font-bold text-token-muted"
          >
            <RefreshCw className="size-3.5" /> New
          </button>
        </div>

        <p className="mt-2 font-mono text-sm leading-relaxed text-token-muted">
          {solve.scramble?.split(/\s+/).map((move, i) => (
            <span key={i} className={i < applied ? "opacity-30" : undefined}>
              {move}{" "}
            </span>
          ))}
        </p>

        <div className="mt-3 flex items-center gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-token-muted">Next</p>
            <p className="font-display text-3xl font-extrabold" style={{ color: "var(--kid-accent)" }}>
              {solve.remaining[0] ?? "—"}
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-strong">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${total ? (applied / total) * 100 : 0}%`,
                  backgroundColor: "var(--kid-accent)",
                }}
              />
            </div>
            {solve.wrongTurns > 0 ? (
              <p className="mt-1.5 text-xs text-token-muted">
                {solve.wrongTurns} turn{solve.wrongTurns === 1 ? "" : "s"} off the scramble — keep
                going, it only matters that the cube ends up right.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (solve.phase === "ready") {
    return (
      <div className="surface rounded-2xl p-4 text-center">
        <Check className="mx-auto size-7" style={{ color: "var(--kid-accent)" }} />
        <p className="font-display mt-2 text-lg font-bold text-token">Scrambled and ready</p>
        <p className="mt-1 text-sm text-token-muted">
          Start inspection when you are. The timer starts on your first turn and stops by itself.
        </p>
        <button
          onClick={onStartInspection}
          className="mt-3 rounded-xl px-5 py-2.5 font-bold text-black"
          style={{ backgroundColor: "var(--kid-accent)" }}
        >
          Start inspection
        </button>
      </div>
    );
  }

  if (solve.phase === "inspecting") {
    const remaining = Math.max(0, INSPECTION_LIMIT_MS - inspectionMs);
    const over = remaining <= 0;
    return (
      <div className="surface rounded-2xl p-5 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-token-muted">
          Inspection
        </p>
        <p
          className="font-display text-5xl font-extrabold tabular-nums"
          style={{ color: over ? "#ef4444" : "var(--kid-accent)" }}
        >
          {(remaining / 1000).toFixed(1)}
        </p>
        <p className="mt-1 text-sm text-token-muted">
          {over ? "Over 15 seconds — this will be a +2." : "Turn the cube to start the timer."}
        </p>
      </div>
    );
  }

  if (solve.phase === "solving") {
    return (
      <div className="surface rounded-2xl p-5 text-center">
        <p className="font-display text-5xl font-extrabold tabular-nums text-token">
          {(liveMs / 1000).toFixed(1)}
        </p>
        <p className="mt-1 text-sm text-token-muted">
          {solve.moves.length} turn{solve.moves.length === 1 ? "" : "s"}
        </p>
      </div>
    );
  }

  if (solve.phase === "solved") {
    const dnf = solve.penalty === "dnf";
    const cs =
      solve.endTs !== null && solve.startTs !== null
        ? Math.round((solve.endTs - solve.startTs) / 10) + (solve.penalty === "plus2" ? 200 : 0)
        : null;
    return (
      <div className="surface rounded-2xl p-5 text-center">
        <p className="font-display text-5xl font-extrabold tabular-nums text-token">
          {dnf || cs === null ? "DNF" : formatCs(cs)}
        </p>
        {solve.penalty === "plus2" ? (
          <p className="mt-1 text-sm text-token-muted">Includes a +2 for a long inspection.</p>
        ) : null}
        <button
          onClick={onNextScramble}
          className="mt-3 rounded-xl px-5 py-2.5 font-bold text-black"
          style={{ backgroundColor: "var(--kid-accent)" }}
        >
          Next scramble
        </button>
      </div>
    );
  }

  return (
    <div className="surface rounded-2xl p-4">
      <p className="text-sm text-token-muted">Getting a scramble…</p>
    </div>
  );
}
