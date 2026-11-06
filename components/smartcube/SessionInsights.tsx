"use client";

import { Lightbulb } from "lucide-react";
import { aoN, formatCs } from "@/lib/cubing";
import { headlineInsight, summariseSession } from "@/lib/smartcube/insights";
import type { SmartSolveRecord } from "@/lib/smartcube/solveStore";

/**
 * What the session says, once there's enough of it to say anything.
 *
 * The headline deliberately refuses to appear before three analysed solves: a confident-sounding
 * claim from one solve is worse than no claim, because it sends someone off practising the wrong
 * thing.
 */
export function SessionInsights({ solves }: { solves: readonly SmartSolveRecord[] }) {
  if (solves.length === 0) return null;

  // A solve saved before analysis existed has no reconstruction; it still counts as a time, just
  // not towards the step insights.
  const insights = summariseSession(
    solves.map((s) => s.analysis).filter((a): a is NonNullable<typeof a> => a !== null)
  );
  const headline = headlineInsight(insights);

  // Reuses the app's own WCA-correct average, so these agree with the Practice tab's numbers.
  const times = solves.map((s) => (s.penalty === "dnf" || s.timeCs === null ? -1 : s.timeCs));
  const best = Math.min(...times.filter((t) => t > 0));
  const ao5 = times.length >= 5 ? aoN(times.slice(0, 5)) : null;

  return (
    <div className="space-y-4">
      <div className="surface rounded-2xl p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-token-muted">
          Session · {solves.length} solve{solves.length === 1 ? "" : "s"}
        </p>
        <dl className="mt-2 grid grid-cols-4 gap-3">
          <Stat label="Best" value={Number.isFinite(best) ? formatCs(best) : "–"} />
          <Stat label="Ao5" value={ao5 && ao5 > 0 ? formatCs(ao5) : "–"} />
          <Stat label="Turns" value={insights.avgMoveCount ? insights.avgMoveCount.toFixed(0) : "–"} />
          <Stat label="TPS" value={insights.avgTps ? insights.avgTps.toFixed(1) : "–"} />
        </dl>
      </div>

      {headline ? (
        <div className="surface rounded-2xl p-4">
          <p className="flex items-start gap-2 text-sm text-token">
            <Lightbulb className="mt-0.5 size-4 shrink-0" style={{ color: "var(--kid-accent)" }} />
            {headline}
          </p>
        </div>
      ) : insights.analysed > 0 ? (
        <div className="surface rounded-2xl p-4">
          <p className="text-sm text-token-muted">
            {3 - insights.analysed} more solve{3 - insights.analysed === 1 ? "" : "s"} and this will
            tell you where your time is going.
          </p>
        </div>
      ) : null}

      {insights.steps.length > 0 ? (
        <div className="surface rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-token-muted">
            Average by step
          </p>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wider text-token-muted">
                <th className="pb-1 text-left font-bold">Step</th>
                <th className="pb-1 text-right font-bold">Looking</th>
                <th className="pb-1 text-right font-bold">Turning</th>
                <th className="pb-1 text-right font-bold">Share</th>
              </tr>
            </thead>
            <tbody>
              {insights.steps.map((step) => (
                <tr
                  key={step.name}
                  className={step.name === insights.worstStep?.name ? "font-bold text-token" : "text-token-muted"}
                >
                  <td className="py-0.5">{step.label}</td>
                  <td className="py-0.5 text-right tabular-nums">
                    {(step.avgRecognitionMs / 1000).toFixed(2)}s
                  </td>
                  <td className="py-0.5 text-right tabular-nums">
                    {(step.avgExecutionMs / 1000).toFixed(2)}s
                  </td>
                  <td className="py-0.5 text-right tabular-nums">
                    {Math.round(step.shareOfSolve * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {insights.unanalysed > 0 ? (
            <p className="mt-2 text-xs text-token-muted">
              {insights.unanalysed} solve{insights.unanalysed === 1 ? "" : "s"} couldn&apos;t be
              broken into steps and {insights.unanalysed === 1 ? "is" : "are"} left out of these
              averages.
            </p>
          ) : null}
        </div>
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
