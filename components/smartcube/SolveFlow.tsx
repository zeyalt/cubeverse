"use client";

import type { ReactNode } from "react";
import { Check, RefreshCw, Undo2 } from "lucide-react";
import { formatCs } from "@/lib/cubing";
import { toQuarterTurns } from "@/lib/smartcube/facelets";
import { INSPECTION_LIMIT_MS } from "@/lib/smartcube/solveMachine";
import type { SolveState } from "@/lib/smartcube/solveMachine";
import type { SmartSolveRecord } from "@/lib/smartcube/solveStore";
import { PhaseBar } from "./PhaseBar";

/**
 * The timer card: one card that holds the scramble, the live cube and the time, and changes with
 * the phase of the solve.
 *
 * The cube lives *inside* this card rather than in its own box below. They are one thing — you look
 * at the scramble, turn the cube, watch it follow — and drawing them as separate panels made the
 * screen read as a stack of unrelated widgets.
 *
 * The scramble is shown whole, with completed turns dimmed and the next one picked out, so you can
 * read ahead as you would on paper. Turns are quarter turns because that is what the cube reports:
 * `R2` appears as `R R`. Showing `R2` and lighting it halfway through was the bug that made the
 * scramble checker useless, so the slightly unusual notation is deliberate.
 */
export function SolveFlow({
  solve,
  solveNumber,
  cube,
  inspectionMs,
  liveMs,
  latest,
  onStartInspection,
  onNextScramble,
  onPenalty,
}: {
  solve: SolveState;
  solveNumber: number;
  /** The live 3D cube, rendered inside the card. */
  cube: ReactNode;
  inspectionMs: number;
  liveMs: number;
  latest: SmartSolveRecord | null;
  onStartInspection: () => void;
  onNextScramble: () => void;
  onPenalty?: (penalty: "none" | "plus2" | "dnf") => void;
}) {
  const turns = solve.scramble ? toQuarterTurns(solve.scramble) : [];
  const applied = turns.length - solve.remaining.length;
  const cubeFrame = <div className="relative -mx-1 h-[clamp(190px,32vh,300px)]">{cube}</div>;

  if (solve.phase === "solving") {
    // Nothing but the cube and the time; the tab hides everything else around it.
    return (
      <div className="surface rounded-3xl p-4">
        {cubeFrame}
        <p className="font-display text-center text-6xl font-extrabold tabular-nums text-token">
          {(liveMs / 1000).toFixed(1)}
        </p>
        <p className="mt-1 text-center text-sm text-token-muted">
          {solve.moves.length} turn{solve.moves.length === 1 ? "" : "s"}
        </p>
      </div>
    );
  }

  return (
    <div className="surface rounded-3xl p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xs text-token-muted">
          #{solveNumber} · 3x3x3
        </p>
        {/* After a solve, "Next scramble" is the primary action below; a second one here would
            compete with it. */}
        {solve.phase === "solved" ? null : (
          <button
            onClick={onNextScramble}
            className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-token-muted hover:text-token"
          >
            <RefreshCw className="size-3.5" /> New scramble
          </button>
        )}
      </div>

      {solve.phase === "scrambling" ? (
        <>
          {/* Done turns dim; the next is larger and bold, so its state doesn't rest on colour. */}
          <p className="mt-2 text-center font-mono text-lg leading-loose" aria-live="polite">
            {turns.map((move, i) => (
              <span
                key={i}
                className={
                  i < applied
                    ? "text-token-muted opacity-35"
                    : i === applied
                      ? "text-[1.3em] font-bold"
                      : "text-token"
                }
                style={i === applied ? { color: solve.wrongTurn ? "#f87171" : "var(--kid-accent)" } : undefined}
              >
                {move}{" "}
              </span>
            ))}
          </p>

          {solve.wrongTurn ? (
            <div role="alert" className="mt-2 flex items-center gap-2 rounded-xl border-l-4 border-red-500 bg-surface-strong p-3">
              <Undo2 className="size-4 shrink-0 text-red-400" />
              <p className="text-sm font-bold text-token">
                You turned {solve.wrongTurn.move}. Turn{" "}
                <span className="font-mono" style={{ color: "var(--kid-accent)" }}>
                  {solve.wrongTurn.undo}
                </span>{" "}
                to put it back.
              </p>
            </div>
          ) : null}

          {cubeFrame}

          <div className="h-1.5 overflow-hidden rounded-full bg-surface-strong">
            <div
              className="h-full rounded-full transition-[width] duration-200"
              style={{
                width: `${turns.length ? (applied / turns.length) * 100 : 0}%`,
                backgroundColor: "var(--kid-accent)",
              }}
            />
          </div>
          <p className="mt-1.5 text-center text-xs text-token-muted">
            Scrambling: {applied} of {turns.length} turns
          </p>
        </>
      ) : null}

      {solve.phase === "ready" ? (
        <>
          {cubeFrame}
          <div className="text-center">
            <p className="font-display flex items-center justify-center gap-2 text-xl font-bold text-token">
              <Check className="size-5" style={{ color: "var(--kid-accent)" }} /> You can start
            </p>
            <p className="mt-1 text-sm text-token-muted">
              The timer starts on your first turn and stops when the cube is solved.
            </p>
            <button
              onClick={onStartInspection}
              className="mt-3 min-h-11 cursor-pointer rounded-xl border border-token px-5 text-sm font-bold text-token-muted hover:text-token"
            >
              Inspect first (15s)
            </button>
          </div>
        </>
      ) : null}

      {solve.phase === "inspecting" ? (
        <InspectionPanel inspectionMs={inspectionMs} cube={cubeFrame} />
      ) : null}

      {solve.phase === "solved" ? (
        <ResultPanel
          solve={solve}
          latest={latest}
          cube={cubeFrame}
          onPenalty={onPenalty}
          onNextScramble={onNextScramble}
        />
      ) : null}

      {solve.phase === "idle" ? (
        <>
          {cubeFrame}
          <p className="text-center text-sm text-token-muted">Getting a scramble…</p>
        </>
      ) : null}
    </div>
  );
}

function InspectionPanel({ inspectionMs, cube }: { inspectionMs: number; cube: ReactNode }) {
  const remaining = Math.max(0, INSPECTION_LIMIT_MS - inspectionMs);
  const over = remaining <= 0;
  return (
    <>
      {cube}
      <div className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-token-muted">Inspection</p>
        <p
          className="font-display text-6xl font-extrabold tabular-nums"
          style={{ color: over ? "#f87171" : "var(--kid-accent)" }}
        >
          {(remaining / 1000).toFixed(1)}
        </p>
        <p className="mt-1 text-sm text-token-muted">
          {over ? "Over 15 seconds: this will be a +2." : "Turn the cube to start the timer."}
        </p>
      </div>
    </>
  );
}

function ResultPanel({
  solve,
  latest,
  cube,
  onPenalty,
  onNextScramble,
}: {
  solve: SolveState;
  latest: SmartSolveRecord | null;
  cube: ReactNode;
  onPenalty?: (penalty: "none" | "plus2" | "dnf") => void;
  onNextScramble: () => void;
}) {
  const dnf = solve.penalty === "dnf";
  const cs =
    solve.endTs !== null && solve.startTs !== null
      ? Math.round((solve.endTs - solve.startTs) / 10) + (solve.penalty === "plus2" ? 200 : 0)
      : null;
  const analysis = latest?.analysis ?? null;

  return (
    <>
      {cube}
      <p className="font-display text-center text-6xl font-extrabold tabular-nums text-token">
        {dnf || cs === null ? "DNF" : formatCs(cs)}
      </p>
      {analysis ? (
        <p className="mt-1 text-center font-mono text-xs text-token-muted">
          {analysis.tps.toFixed(2)} TPS │ {analysis.turns} turns │ {Math.round(analysis.fluency * 100)}% fluency
        </p>
      ) : null}
      {solve.penalty === "plus2" ? (
        <p className="mt-1 text-center text-xs text-token-muted">Includes +2 for a long inspection.</p>
      ) : null}

      {analysis && latest ? (
        <div className="mt-4">
          <PhaseBar analysis={analysis} moves={latest.moves} />
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        {onPenalty ? (
          <>
            <PenaltyButton
              label="+2"
              active={solve.penalty === "plus2"}
              onClick={() => onPenalty(solve.penalty === "plus2" ? "none" : "plus2")}
            />
            <PenaltyButton label="DNF" active={dnf} onClick={() => onPenalty(dnf ? "none" : "dnf")} />
          </>
        ) : null}
        <button
          onClick={onNextScramble}
          className="min-h-11 flex-1 cursor-pointer rounded-xl px-5 font-bold text-black"
          style={{ backgroundColor: "var(--kid-accent)" }}
        >
          Next scramble
        </button>
      </div>
    </>
  );
}

function PenaltyButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="min-h-11 min-w-14 cursor-pointer rounded-xl border px-3 text-sm font-bold"
      style={{
        borderColor: active ? "var(--kid-accent)" : "var(--kid-border-c)",
        color: active ? "var(--kid-accent)" : "var(--kid-fg-muted)",
      }}
    >
      {label}
    </button>
  );
}
