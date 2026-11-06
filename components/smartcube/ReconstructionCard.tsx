"use client";

import { AlertTriangle } from "lucide-react";
import type { CompletedSolve } from "@/lib/smartcube/useSmartSolve";

/**
 * Breakdown of the solve just finished.
 *
 * Each step shows two bars: time spent *looking* and time spent *turning*. They're drawn to the
 * same scale across steps, so the slow part of a solve is visible at a glance rather than needing
 * the numbers read and compared.
 */
export function ReconstructionCard({ solve }: { solve: CompletedSolve }) {
  const { analysis } = solve;

  if (analysis.method !== "cfop" || analysis.steps.length === 0) {
    return (
      <div className="surface rounded-2xl p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-token-muted">
          This solve
        </p>
        <div className="mt-2 flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-token-muted" />
          <p className="text-sm text-token-muted">
            {analysis.reason ?? "Couldn't break this solve into steps."}
          </p>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-3">
          <Stat label="Turns" value={String(analysis.moveCount)} />
          <Stat label="TPS" value={analysis.tps.toFixed(1)} />
          <Stat label="Pauses" value={String(analysis.pauseCount)} />
        </dl>
      </div>
    );
  }

  const longest = Math.max(
    ...analysis.steps.map((s) => s.recognitionMs + s.executionMs),
    1
  );

  return (
    <div className="surface rounded-2xl p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-token-muted">
          This solve
        </p>
        <p className="text-xs text-token-muted">
          {analysis.moveCount} turns · {analysis.tps.toFixed(1)} TPS
        </p>
      </div>

      {analysis.confidence === "low" ? (
        <p className="mt-2 flex items-start gap-2 text-xs text-token-muted">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {analysis.reason}
        </p>
      ) : null}

      <div className="mt-3 space-y-2.5">
        {analysis.steps.map((step) => {
          const total = step.recognitionMs + step.executionMs;
          return (
            <div key={step.name}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-bold text-token">{step.label}</span>
                <span className="tabular-nums text-token-muted">
                  {(total / 1000).toFixed(2)}s · {step.moveCount} turns
                  {step.pauseCount > 0 ? ` · ${step.pauseCount} pause${step.pauseCount === 1 ? "" : "s"}` : ""}
                </span>
              </div>
              <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-surface-strong">
                <div
                  className="h-full"
                  style={{
                    width: `${(step.recognitionMs / longest) * 100}%`,
                    backgroundColor: "var(--kid-accent)",
                    opacity: 0.45,
                  }}
                  title={`Looking: ${(step.recognitionMs / 1000).toFixed(2)}s`}
                />
                <div
                  className="h-full"
                  style={{
                    width: `${(step.executionMs / longest) * 100}%`,
                    backgroundColor: "var(--kid-accent)",
                  }}
                  title={`Turning: ${(step.executionMs / 1000).toFixed(2)}s`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-token-muted">
        <span className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: "var(--kid-accent)", opacity: 0.45 }}
          />
          Looking
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: "var(--kid-accent)" }} />
          Turning
        </span>
      </p>

      {solve.timingSource === "local" ? (
        <p className="mt-2 text-xs text-token-muted">
          Timed by this device rather than the cube — splits are less precise.
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-token-muted">{label}</dt>
      <dd className="font-display text-xl font-extrabold tabular-nums text-token">{value}</dd>
    </div>
  );
}
