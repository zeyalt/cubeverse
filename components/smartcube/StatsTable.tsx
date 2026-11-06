"use client";

import { DNF, formatCs } from "@/lib/cubing";
import { bestSingleIndex, sessionStats } from "@/lib/smartcube/sessionStats";
import type { SmartSolveRecord } from "@/lib/smartcube/solveStore";

/**
 * The two-column stats block from spec §4.7: the last five solves on the left, the session's
 * averages on the right.
 *
 * A row whose current value *is* its best gets the accent colour — that's a record just set, which
 * is the only time the distinction is interesting. All the averaging comes from `lib/cubing.ts`, so
 * these numbers mean exactly what the Practice tab's numbers mean.
 */

const RECENT = 5;

/** Oldest-first effective times, which is what every average helper in this repo expects. */
const effectiveTimes = (solves: readonly SmartSolveRecord[]): number[] =>
  [...solves]
    .reverse()
    .map((s) => (s.penalty === "dnf" || s.timeCs === null ? DNF : s.timeCs + (s.penalty === "plus2" ? 200 : 0)));

const show = (cs: number | null) => (cs === null ? "–" : formatCs(cs));

export function StatsTable({
  solves,
  onSelect,
}: {
  solves: readonly SmartSolveRecord[];
  onSelect?: (solve: SmartSolveRecord) => void;
}) {
  if (solves.length === 0) return null;

  const times = effectiveTimes(solves);
  const rows = sessionStats(times);
  // `times` is oldest-first and `solves` is newest-first, so the index has to be flipped back.
  const bestIndex = bestSingleIndex(times);
  const bestSolveId = bestIndex === null ? null : solves[times.length - 1 - bestIndex]?.id;
  const recent = solves.slice(0, RECENT);

  return (
    <div className="surface grid grid-cols-2 gap-4 rounded-2xl p-4 font-mono text-xs tabular-nums">
      <div>
        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-token-muted">
          <span>TPS</span>
          <span>Time</span>
        </div>
        <ul className="mt-1.5 space-y-1">
          {recent.map((solve) => {
            const isBest = solve.id === bestSolveId;
            return (
              <li key={solve.id}>
                <button
                  onClick={() => onSelect?.(solve)}
                  disabled={!onSelect}
                  className="flex w-full justify-between disabled:cursor-default"
                  style={{ color: isBest ? "var(--kid-accent)" : undefined }}
                >
                  <span>{solve.analysis ? solve.analysis.tps.toFixed(2) : "–"}</span>
                  <span className="font-bold">
                    {solve.penalty === "dnf" || solve.timeCs === null
                      ? "DNF"
                      : formatCs(solve.timeCs + (solve.penalty === "plus2" ? 200 : 0))}
                    {solve.penalty === "plus2" ? "+" : ""}
                    {/* A solve still in the outbox is marked, not implied to be saved. */}
                    {solve.pending ? <span className="text-token-muted"> ·</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <div className="grid grid-cols-[auto_1fr_1fr] gap-x-2 text-[10px] font-bold uppercase tracking-wider text-token-muted">
          <span />
          <span className="text-right">Now</span>
          <span className="text-right">Best</span>
        </div>
        <div className="mt-1.5 grid grid-cols-[auto_1fr_1fr] gap-x-2 gap-y-1">
          {rows.map((row) => (
            <div key={row.n} className="col-span-3 grid grid-cols-subgrid" style={{ color: row.isRecord ? "var(--kid-accent)" : undefined }}>
              <span className={row.isRecord ? "font-bold" : "text-token-muted"}>{row.label}</span>
              <span className="text-right font-bold">
                {row.now === DNF ? "DNF" : show(row.now)}
              </span>
              <span className={`text-right ${row.isRecord ? "" : "text-token-muted"}`}>
                {show(row.best)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
