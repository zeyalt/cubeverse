"use client";

import { useEffect, useMemo, useState } from "react";
import { CloudOff, Trash2, X } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DNF, formatCs } from "@/lib/cubing";
import { effectiveCs, rollingSeries, type StatWindow } from "@/lib/smartcube/sessionStats";
import type { SmartSolveRecord } from "@/lib/smartcube/solveStore";
import { chartColors } from "@/lib/chartTheme";
import { useTheme } from "@/lib/useTheme";
import { EmptyState } from "./InsightsView";
import { PhaseBar } from "./PhaseBar";
import { ReconstructionCard } from "./ReconstructionCard";
import { Segmented } from "./Segmented";

/**
 * History: every smart-cube solve, as a trend and as a list.
 *
 * The chart answers "am I getting faster?" and the list answers "what happened on that one?" — tap
 * a row and its full breakdown opens, with the penalty and delete controls that belong to a single
 * solve rather than to the session.
 */

const WINDOWS: ReadonlyArray<{ value: `${StatWindow}`; label: string }> = [
  { value: "1", label: "Single" },
  { value: "5", label: "Ao5" },
  { value: "12", label: "Ao12" },
  { value: "100", label: "Ao100" },
];

/** Rows shown before "Show all": enough to scroll, not so many the page drags. */
const PAGE = 50;

export function HistoryView({
  solves,
  onPenalty,
  onDelete,
}: {
  solves: readonly SmartSolveRecord[];
  onPenalty: (id: string, penalty: "none" | "plus2" | "dnf") => void;
  onDelete: (id: string) => void;
}) {
  const [windowSize, setWindowSize] = useState<`${StatWindow}`>("1");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const { theme } = useTheme();
  const colors = chartColors(theme);

  // Oldest first for the chart and for numbering; the list shows newest first.
  const chronological = useMemo(() => [...solves].reverse(), [solves]);
  const times = useMemo(() => chronological.map(effectiveCs), [chronological]);
  const series = useMemo(
    () => rollingSeries(times, Number(windowSize) as StatWindow),
    [times, windowSize]
  );
  const data = series.map((cs, i) => ({ n: i + 1, s: cs === null ? null : cs / 100 }));
  const plotted = data.filter((d) => d.s !== null).length;
  const numberOf = (solve: SmartSolveRecord) => solves.length - solves.indexOf(solve);
  const open = openId ? solves.find((x) => x.id === openId) ?? null : null;

  if (solves.length === 0) {
    return (
      <EmptyState
        title="No solves yet"
        detail="Solve with your smart cube on the Timer tab and every solve lands here, with its full breakdown."
      />
    );
  }

  const rows = showAll ? solves : solves.slice(0, PAGE);

  return (
    <div className="space-y-4">
      <section className="surface rounded-2xl p-4" aria-labelledby="history-heading">
        <h2 id="history-heading" className="font-display text-base font-bold text-token">
          History
        </h2>
        <div className="mt-3">
          <Segmented label="Average" size="sm" options={WINDOWS} value={windowSize} onChange={setWindowSize} />
        </div>

        {plotted >= 2 ? (
          <div className="mt-3 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke={colors.grid} vertical={false} />
                <XAxis
                  dataKey="n"
                  tick={{ fill: colors.tick, fontSize: 10 }}
                  stroke={colors.axis}
                  allowDecimals={false}
                />
                <YAxis
                  tick={{ fill: colors.tick, fontSize: 10 }}
                  stroke={colors.axis}
                  domain={["dataMin - 2", "dataMax + 2"]}
                  tickFormatter={(v: number) => `${Math.round(v)}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: colors.tooltipBg,
                    border: colors.tooltipBorder,
                    borderRadius: 8,
                    color: colors.tooltipText,
                    fontSize: 11,
                  }}
                  labelFormatter={(n) => `Solve #${n}`}
                  formatter={(v) => [formatCs(Math.round(Number(v) * 100)), WINDOWS.find((w) => w.value === windowSize)?.label]}
                />
                <Area
                  dataKey="s"
                  type="monotone"
                  stroke={colors.avgAo12}
                  fill={colors.avgAo12}
                  fillOpacity={0.18}
                  strokeWidth={2}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-4 text-sm text-token-muted">
            {windowSize === "1"
              ? "The trend appears after your second solve."
              : `An ${WINDOWS.find((w) => w.value === windowSize)?.label} needs ${windowSize} solves; you have ${solves.length}.`}
          </p>
        )}
      </section>

      <section className="surface overflow-hidden rounded-2xl" aria-label="Solves">
        <table className="w-full font-mono text-sm tabular-nums">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-token-muted">
              <th scope="col" className="px-4 py-2.5 text-left font-bold">#</th>
              <th scope="col" className="px-2 py-2.5 text-right font-bold">Time</th>
              <th scope="col" className="px-2 py-2.5 text-right font-bold">TPS</th>
              <th scope="col" className="px-4 py-2.5 text-right font-bold">Turns</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((solve) => {
              const cs = effectiveCs(solve);
              return (
                <tr
                  key={solve.id}
                  onClick={() => setOpenId(solve.id)}
                  className="cursor-pointer border-t border-token hover:bg-surface-strong"
                >
                  <td className="px-4 py-3 text-token-muted">
                    {/* The row is a button for keyboard users too, not only a click target. */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenId(solve.id);
                      }}
                      className="cursor-pointer"
                      aria-label={`Open solve ${numberOf(solve)}`}
                    >
                      {numberOf(solve)}
                    </button>
                  </td>
                  <td className="px-2 py-3 text-right font-bold text-token">
                    {cs === DNF ? "DNF" : formatCs(cs)}
                    {solve.penalty === "plus2" ? <span className="text-token-muted">+</span> : null}
                    {solve.pending ? (
                      <CloudOff className="ml-1.5 inline size-3 text-token-muted" aria-label="Waiting to sync" />
                    ) : null}
                  </td>
                  <td className="px-2 py-3 text-right text-token-muted">
                    {solve.analysis ? solve.analysis.tps.toFixed(2) : "–"}
                  </td>
                  <td className="px-4 py-3 text-right text-token-muted">
                    {solve.analysis ? solve.analysis.turns : "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!showAll && solves.length > PAGE ? (
          <button
            onClick={() => setShowAll(true)}
            className="w-full cursor-pointer border-t border-token py-3 text-sm font-bold text-token-muted"
          >
            Show all {solves.length}
          </button>
        ) : null}
      </section>

      {open ? (
        <SolveDetail
          solve={open}
          number={numberOf(open)}
          onClose={() => setOpenId(null)}
          onPenalty={(penalty) => onPenalty(open.id, penalty)}
          onDelete={() => {
            onDelete(open.id);
            setOpenId(null);
          }}
        />
      ) : null}
    </div>
  );
}

/** One solve's whole story, in a sheet over the list. */
function SolveDetail({
  solve,
  number,
  onClose,
  onPenalty,
  onDelete,
}: {
  solve: SmartSolveRecord;
  number: number;
  onClose: () => void;
  onPenalty: (penalty: "none" | "plus2" | "dnf") => void;
  onDelete: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const cs = effectiveCs(solve);
  const analysis = solve.analysis;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="solve-detail-title"
        // Opaque, unlike a card: `.surface` is translucent so cards sit on the canvas, and a sheet
        // with the list showing through it is unreadable.
        className="bg-sheet max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-token p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-token-muted">
              #{number} · {new Date(solve.solvedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
            </p>
            <h2 id="solve-detail-title" className="font-display mt-1 text-4xl font-extrabold tabular-nums text-token">
              {cs === DNF ? "DNF" : formatCs(cs)}
            </h2>
            {analysis ? (
              <p className="mt-1 font-mono text-xs text-token-muted">
                {analysis.tps.toFixed(2)} TPS · {analysis.turns} turns · {Math.round(analysis.fluency * 100)}% fluency
              </p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface-strong text-token"
          >
            <X className="size-5" />
          </button>
        </div>

        {solve.scramble ? (
          <p className="mt-4 rounded-xl bg-surface-strong p-3 font-mono text-xs leading-relaxed text-token-muted">
            {solve.scramble}
          </p>
        ) : null}

        {analysis ? (
          <div className="mt-4">
            <PhaseBar analysis={analysis} moves={solve.moves} />
          </div>
        ) : null}

        <div className="mt-4">
          <ReconstructionCard solve={solve} />
        </div>

        {/* Editing a solve that hasn't reached the server yet isn't supported — its row doesn't
            exist to update — so the controls say why rather than silently doing nothing. */}
        {solve.pending ? (
          <p className="mt-4 text-xs text-token-muted">
            This solve is still waiting to sync. You can change its penalty once it has.
          </p>
        ) : (
          <div className="mt-5 flex items-center gap-2">
            <PenaltyToggle
              label="+2"
              active={solve.penalty === "plus2"}
              onClick={() => onPenalty(solve.penalty === "plus2" ? "none" : "plus2")}
            />
            <PenaltyToggle
              label="DNF"
              active={solve.penalty === "dnf"}
              onClick={() => onPenalty(solve.penalty === "dnf" ? "none" : "dnf")}
            />
            <div className="flex-1" />
            {confirmingDelete ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="min-h-11 cursor-pointer rounded-xl px-3 text-sm font-bold text-token-muted"
                >
                  Keep
                </button>
                <button
                  onClick={onDelete}
                  className="min-h-11 cursor-pointer rounded-xl bg-red-600 px-4 text-sm font-bold text-white"
                >
                  Delete solve
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                aria-label="Delete this solve"
                className="flex size-11 cursor-pointer items-center justify-center rounded-xl border border-token text-red-400"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PenaltyToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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
