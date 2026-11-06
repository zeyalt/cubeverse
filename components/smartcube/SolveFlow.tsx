"use client";

import { Check, ChevronLeft, ChevronRight, RefreshCw, Undo2 } from "lucide-react";
import { formatCs } from "@/lib/cubing";
import { toQuarterTurns } from "@/lib/smartcube/facelets";
import { INSPECTION_LIMIT_MS } from "@/lib/smartcube/solveMachine";
import type { SolveState } from "@/lib/smartcube/solveMachine";
import type { SmartSolveRecord } from "@/lib/smartcube/solveStore";
import { PhaseBar } from "./PhaseBar";

/**
 * The top-of-tab panel, which changes with the phase of the solve: the scramble to apply, the
 * inspection countdown, the running timer, then the result.
 *
 * The whole scramble is shown, with completed turns dimmed and the next one picked out, rather than
 * just the next move on its own. Showing only the next move makes the app a set of instructions to
 * follow; showing the sequence with your position in it lets someone read ahead, which is what they
 * would do with a scramble on paper.
 *
 * Turns are displayed as quarter turns because that is what the cube reports, so `R2` appears as
 * `R R`. It looks unusual written down, but it matches what the app can actually verify, and the
 * alternative — showing `R2` and lighting it up halfway through — was the bug that made the
 * scramble checker useless.
 */
export function SolveFlow({
  solve,
  solveNumber,
  inspectionMs,
  liveMs,
  latest,
  onStartInspection,
  onNextScramble,
  onPenalty,
}: {
  solve: SolveState;
  solveNumber: number;
  inspectionMs: number;
  liveMs: number;
  latest: SmartSolveRecord | null;
  onStartInspection: () => void;
  onNextScramble: () => void;
  onPenalty?: (penalty: "none" | "plus2" | "dnf") => void;
}) {
  const turns = solve.scramble ? toQuarterTurns(solve.scramble) : [];
  const applied = turns.length - solve.remaining.length;

  if (solve.phase === "scrambling") {
    return (
      <div className="surface rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs text-token-muted">#{solveNumber}</span>
          <button
            onClick={onNextScramble}
            className="flex items-center gap-1.5 text-xs font-bold text-token-muted"
          >
            <RefreshCw className="size-3.5" /> New scramble
          </button>
        </div>

        {/* Done turns dim, the next one bright and larger. Size and weight carry the state as well
            as colour, so it still reads without colour vision. */}
        <p className="mt-2 font-mono text-base leading-loose">
          {turns.map((move, i) => (
            <span
              key={i}
              className={
                i < applied
                  ? "text-token-muted opacity-40"
                  : i === applied
                    ? "text-[1.35em] font-bold"
                    : "text-token-muted"
              }
              style={i === applied ? { color: solve.wrongTurn ? "#ef4444" : "var(--kid-accent)" } : undefined}
            >
              {move}{" "}
            </span>
          ))}
        </p>

        {solve.wrongTurn ? (
          <div className="mt-2 flex items-center gap-2 rounded-xl border-l-4 border-red-500 bg-surface-strong p-3">
            <Undo2 className="size-4 shrink-0" />
            <p className="text-sm font-bold text-token">
              You turned {solve.wrongTurn.move} — turn{" "}
              <span className="font-mono" style={{ color: "var(--kid-accent)" }}>
                {solve.wrongTurn.undo}
              </span>{" "}
              to put it back.
            </p>
          </div>
        ) : null}

        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-strong">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${turns.length ? (applied / turns.length) * 100 : 0}%`,
                backgroundColor: "var(--kid-accent)",
              }}
            />
          </div>
          <p className="mt-1.5 text-xs text-token-muted">
            {applied} of {turns.length} turns
            {solve.wrongTurns > 0 ? ` · ${solve.wrongTurns} to fix` : ""}
          </p>
        </div>
      </div>
    );
  }

  if (solve.phase === "ready") {
    return (
      <div className="surface rounded-2xl p-4 text-center">
        <Check className="mx-auto size-7" style={{ color: "var(--kid-accent)" }} />
        <p className="font-display mt-2 text-lg font-bold text-token">You can start</p>
        <p className="mt-1 text-sm text-token-muted">
          The timer starts on your first turn and stops the moment the cube is solved.
        </p>
        <button
          onClick={onStartInspection}
          className="mt-3 rounded-xl border border-token px-5 py-2.5 text-sm font-bold text-token-muted"
        >
          Inspection first
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
    // Nothing but the time and the turn count: everything else is hidden by the tab while solving.
    return (
      <div className="surface rounded-2xl p-6 text-center">
        <p className="font-display text-6xl font-extrabold tabular-nums text-token">
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
    const analysis = latest?.analysis ?? null;

    return (
      <div className="surface rounded-2xl p-5">
        <p className="font-display text-center text-5xl font-extrabold tabular-nums text-token">
          {dnf || cs === null ? "DNF" : formatCs(cs)}
        </p>

        {analysis ? (
          <p className="mt-1 text-center font-mono text-xs text-token-muted">
            {analysis.tps.toFixed(2)} TPS · {analysis.turns} turns ·{" "}
            {Math.round(analysis.fluency * 100)}% fluency
          </p>
        ) : null}

        {solve.penalty === "plus2" ? (
          <p className="mt-1 text-center text-xs text-token-muted">
            Includes a +2 for a long inspection.
          </p>
        ) : null}

        {analysis && latest ? (
          <div className="mt-4">
            <PhaseBar analysis={analysis} moves={latest.moves} />
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-center gap-2">
          {onPenalty ? (
            <>
              <PenaltyButton
                label="+2"
                active={solve.penalty === "plus2"}
                onClick={() => onPenalty(solve.penalty === "plus2" ? "none" : "plus2")}
              />
              <PenaltyButton
                label="DNF"
                active={dnf}
                onClick={() => onPenalty(dnf ? "none" : "dnf")}
              />
            </>
          ) : null}
          <button
            onClick={onNextScramble}
            className="rounded-xl px-5 py-2.5 font-bold text-black"
            style={{ backgroundColor: "var(--kid-accent)" }}
          >
            Next scramble
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="surface rounded-2xl p-4">
      <p className="text-sm text-token-muted">Getting a scramble…</p>
    </div>
  );
}

function PenaltyButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="rounded-xl border px-3 py-2.5 text-sm font-bold"
      style={{
        borderColor: active ? "var(--kid-accent)" : "var(--kid-border-c)",
        color: active ? "var(--kid-accent)" : "var(--kid-fg-muted)",
      }}
    >
      {label}
    </button>
  );
}

/** `‹ #84  3x3x3 ›` — the scramble navigator from §4.1.2. */
export function ScrambleNavigator({
  solveNumber,
  eventLabel,
  onPrevious,
  onNext,
  canGoBack,
}: {
  solveNumber: number;
  eventLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  canGoBack: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-3">
      <button
        onClick={onPrevious}
        disabled={!canGoBack}
        aria-label="Previous scramble"
        className="rounded-lg p-1.5 text-token-muted disabled:opacity-30"
      >
        <ChevronLeft className="size-5" />
      </button>
      <span className="font-mono text-xs text-token-muted">#{solveNumber}</span>
      <span
        className="rounded-full border px-3 py-1 text-xs font-bold"
        style={{ borderColor: "var(--kid-accent)", color: "var(--kid-accent)" }}
      >
        {eventLabel}
      </span>
      <button
        onClick={onNext}
        aria-label="Next scramble"
        className="rounded-lg p-1.5 text-token-muted"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
