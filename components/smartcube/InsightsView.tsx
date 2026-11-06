"use client";

import { useMemo, useState } from "react";
import { Info, Lightbulb, Minus, Plus, Target } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  PHASES,
  PHASE_LABEL,
  MIN_SOLVES,
  averageSplits,
  defaultGoalMs,
  goalSplits,
  isPlausible,
  phaseStarts,
  splitTip,
  tpsSeries,
  type Phase,
  type SplitSummary,
} from "@/lib/smartcube/insights";
import { setGoalMs, useGoalMs } from "@/lib/smartcube/goal";
import type { SmartSolveRecord } from "@/lib/smartcube/solveStore";
import { chartColors } from "@/lib/chartTheme";
import { useTheme } from "@/lib/useTheme";
import { DELTA_BETTER, DELTA_WORSE, PHASE_COLOR } from "./palette";
import { Segmented } from "./Segmented";

/**
 * Insights: where your time goes, against where it should go.
 *
 * Laid out like the reference app's — your average split above a goal split, a card per phase with
 * how far each is off, one tip, then turning speed through your latest solve — because that order
 * answers the questions in the order a solver asks them: how am I splitting, what's off, what do I
 * do about it, and what does that look like inside a solve.
 */

type Range = "12" | "50" | "all";
const RANGES: ReadonlyArray<{ value: Range; label: string }> = [
  { value: "12", label: "Last 12" },
  { value: "50", label: "Last 50" },
  { value: "all", label: "All" },
];

const s = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

/**
 * A segment needs this share of the full card width to hold its two-line label. Measured against
 * the bar as drawn: the goal bar is shorter than yours whenever the goal is faster, so the same
 * share is narrower there, and judging by share alone clipped its Cross label.
 */
const LABEL_FITS = 0.13;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function InsightsView({
  cuberId,
  solves,
}: {
  cuberId: string;
  solves: readonly SmartSolveRecord[];
}) {
  const [range, setRange] = useState<Range>("all");
  const [showHelp, setShowHelp] = useState(false);
  const storedGoal = useGoalMs(cuberId);

  const inRange = useMemo(
    () => (range === "all" ? solves : solves.slice(0, Number(range))),
    [range, solves]
  );
  const summary = useMemo(() => averageSplits(inRange), [inRange]);
  // Solves that were analysed but whose numbers can't be true are left out, and said so — silently
  // dropping them would make the count look wrong for no visible reason.
  const damaged = inRange.filter((x) => x.analysis?.method === "cfop" && !isPlausible(x.analysis)).length;
  const usable = inRange.filter((x) => isPlausible(x.analysis)).length;

  if (!summary) {
    return (
      <EmptyState
        title="Insights need a few solves"
        detail={`They appear after ${MIN_SOLVES} solves the app could break into Cross, F2L, OLL and PLL. You have ${usable}.`}
        progress={usable / MIN_SOLVES}
      />
    );
  }

  const goalMs = storedGoal ?? defaultGoalMs(summary.totalMs);
  const goal = goalSplits(goalMs);
  const tip = splitTip(summary);
  const latest = solves.find((x) => isPlausible(x.analysis)) ?? null;

  return (
    <div className="space-y-4">
      <section className="surface rounded-2xl p-4" aria-labelledby="splits-heading">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <h2 id="splits-heading" className="font-display text-base font-bold text-token">
              Average CFOP split
            </h2>
            <button
              onClick={() => setShowHelp((v) => !v)}
              aria-expanded={showHelp}
              aria-label="How splits are measured"
              className="flex size-8 cursor-pointer items-center justify-center rounded-full text-token-muted hover:text-token"
            >
              <Info className="size-4" />
            </button>
          </div>
          <span className="text-xs text-token-muted">
            {summary.count} solve{summary.count === 1 ? "" : "s"}
          </span>
        </div>

        {showHelp ? (
          <p className="mt-1 text-xs leading-relaxed text-token-muted">
            Each phase runs from the end of the one before to its last turn, so the time spent
            looking before you start a phase counts towards it. The goal splits a target time by
            the standard CFOP proportions: 13% cross, 52% F2L, 15% OLL, 20% PLL.
          </p>
        ) : null}

        <div className="mt-3">
          <Segmented label="Solves included" size="sm" options={RANGES} value={range} onChange={setRange} />
        </div>

        <SplitBar
          title="Your splits"
          phases={summary.phases}
          totalMs={summary.totalMs}
          scaleMs={Math.max(summary.totalMs, goalMs)}
        />
        <SplitBar
          title="Goal splits"
          phases={goal}
          totalMs={goalMs}
          scaleMs={Math.max(summary.totalMs, goalMs)}
          muted
        />

        <GoalControl
          goalMs={goalMs}
          custom={storedGoal !== null}
          onChange={(ms) => setGoalMs(cuberId, ms)}
        />

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {summary.phases.map((phase, i) => (
            <PhaseCard key={phase.phase} phase={phase} goalMs={goal[i].ms} goalShare={goal[i].share} />
          ))}
        </div>

        <div
          className="mt-4 flex items-start gap-2.5 rounded-xl p-3"
          style={{
            backgroundColor: tip.tone === "good" ? "rgba(74, 222, 128, 0.12)" : "rgba(250, 204, 21, 0.12)",
          }}
        >
          <Lightbulb
            className="mt-0.5 size-4 shrink-0"
            style={{ color: tip.tone === "good" ? DELTA_BETTER : "#facc15" }}
          />
          <p className="text-sm leading-relaxed text-token">{tip.text}</p>
        </div>

        {damaged > 0 ? (
          <p className="mt-3 text-xs text-token-muted">
            {damaged} solve{damaged === 1 ? " is" : "s are"} left out: a Bluetooth glitch damaged
            {damaged === 1 ? " its" : " their"} timing. The times still count; only the splits are
            unreliable.
          </p>
        ) : null}
      </section>

      {latest ? <TpsCard solve={latest} number={solves.length - solves.indexOf(latest)} /> : null}
    </div>
  );
}

/**
 * One horizontal bar split by phase. Bars share a scale, so a goal faster than you is visibly
 * shorter rather than the same width with smaller numbers.
 */
function SplitBar({
  title,
  phases,
  totalMs,
  scaleMs,
  muted = false,
}: {
  title: string;
  phases: ReadonlyArray<{ phase: Phase; ms: number; share: number }>;
  totalMs: number;
  scaleMs: number;
  muted?: boolean;
}) {
  const width = scaleMs > 0 ? (totalMs / scaleMs) * 100 : 0;
  return (
    <div className="mt-4">
      <p className="text-xs text-token-muted">{title}</p>
      <div className="mt-1.5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div
            className="flex h-11 gap-[2px] overflow-hidden rounded-full"
            style={{ width: `${width}%`, opacity: muted ? 0.6 : 1 }}
            role="img"
            aria-label={`${title}: ${phases
              .map((p) => `${PHASE_LABEL[p.phase]} ${s(p.ms)}, ${pct(p.share)}`)
              .join("; ")}. Total ${s(totalMs)}.`}
          >
            {phases.map((p) =>
              p.share > 0 ? (
                <div
                  key={p.phase}
                  className="flex min-w-0 flex-col items-center justify-center"
                  style={{ flexGrow: p.share, flexBasis: 0, backgroundColor: PHASE_COLOR[p.phase] }}
                >
                  {/* A label is drawn inside only when it fits; the cards below carry every number,
                      so a narrow segment loses nothing by going without. */}
                  {p.share * (width / 100) >= LABEL_FITS ? (
                    <>
                      <span className="text-[11px] font-bold leading-tight tabular-nums text-white">
                        {s(p.ms)}
                      </span>
                      <span className="text-[10px] leading-tight tabular-nums text-white/80">
                        {pct(p.share)}
                      </span>
                    </>
                  ) : null}
                </div>
              ) : null
            )}
          </div>
        </div>
        <span className="w-14 shrink-0 text-right text-sm font-bold tabular-nums text-token">
          {s(totalMs)}
        </span>
      </div>
    </div>
  );
}

function GoalControl({
  goalMs,
  custom,
  onChange,
}: {
  goalMs: number;
  custom: boolean;
  onChange: (ms: number | null) => void;
}) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-surface-strong px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Target className="size-4 shrink-0 text-token-muted" />
        <div className="min-w-0">
          <p className="text-sm font-bold tabular-nums text-token">Goal {(goalMs / 1000).toFixed(0)}s</p>
          <p className="truncate text-[11px] text-token-muted">
            {custom ? (
              <button onClick={() => onChange(null)} className="cursor-pointer underline">
                Use suggested goal
              </button>
            ) : (
              "Suggested, 20% faster than now"
            )}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button
          onClick={() => onChange(Math.max(5_000, goalMs - 1_000))}
          aria-label="Lower goal by one second"
          className="flex size-10 cursor-pointer items-center justify-center rounded-lg border border-token text-token"
        >
          <Minus className="size-4" />
        </button>
        <button
          onClick={() => onChange(goalMs + 1_000)}
          aria-label="Raise goal by one second"
          className="flex size-10 cursor-pointer items-center justify-center rounded-lg border border-token text-token"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** Signed difference, coloured by whether it's worse than the goal. The sign carries it too. */
function Delta({ value, format }: { value: number; format: (abs: number) => string }) {
  const worse = value > 0;
  return (
    <span className="tabular-nums" style={{ color: worse ? DELTA_WORSE : DELTA_BETTER }}>
      ({worse ? "+" : "−"}
      {format(Math.abs(value))})
    </span>
  );
}

function PhaseCard({
  phase,
  goalMs,
  goalShare,
}: {
  phase: SplitSummary["phases"][number];
  goalMs: number;
  goalShare: number;
}) {
  return (
    <div className="rounded-xl bg-surface-strong p-3">
      <p className="flex items-center gap-1.5 text-sm font-bold text-token">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: PHASE_COLOR[phase.phase] }} />
        {PHASE_LABEL[phase.phase]}
      </p>
      <p className="mt-1.5 text-sm">
        <span className="font-bold tabular-nums text-token">{s(phase.ms)}</span>{" "}
        <Delta value={phase.ms - goalMs} format={s} />
      </p>
      <p className="text-sm text-token-muted">
        <span className="tabular-nums">{pct(phase.share)}</span>{" "}
        <Delta value={phase.share - goalShare} format={pct} />
      </p>
      <p className="mt-0.5 text-xs tabular-nums text-token-muted">
        {phase.tps.toFixed(2)} TPS · {phase.turns.toFixed(1)} turns
      </p>
    </div>
  );
}

type TpsMode = "segregated" | "linear";
const TPS_MODES: ReadonlyArray<{ value: TpsMode; label: string }> = [
  { value: "segregated", label: "By phase" },
  { value: "linear", label: "Linear" },
];

/**
 * Turning speed through one solve. "By phase" colours each phase and marks where it starts, which
 * is what shows the shape of a solve: the dips are recognition, the peaks are algorithms you know.
 * "Linear" is the same curve on its own, for reading the speed itself.
 */
function TpsCard({ solve, number }: { solve: SmartSolveRecord; number: number }) {
  const [mode, setMode] = useState<TpsMode>("segregated");
  const { theme } = useTheme();
  const colors = chartColors(theme);

  const series = useMemo(() => tpsSeries(solve), [solve]);
  const starts = useMemo(() => phaseStarts(solve), [solve]);
  // One column per phase, null outside it, so each phase draws as its own coloured area. A phase's
  // first point repeats the previous phase's last value, or the areas would have a gap between them.
  const data = useMemo(
    () =>
      series.map((p, i) => {
        const row: Record<string, number | null> = { t: p.t, all: p.tps };
        for (const phase of PHASES) {
          const here = p.phase === phase;
          const joinsNext = series[i + 1]?.phase === phase;
          row[phase] = here || joinsNext ? p.tps : null;
        }
        return row;
      }),
    [series]
  );

  if (series.length === 0) return null;
  const peak = Math.max(...series.map((p) => p.tps));

  return (
    <section className="surface rounded-2xl p-4" aria-labelledby="tps-heading">
      <h2 id="tps-heading" className="font-display text-base font-bold text-token">
        Turning speed
      </h2>
      <p className="text-xs text-token-muted">
        Latest solve, #{number} · peak {peak.toFixed(1)} TPS
      </p>
      <div className="mt-3">
        <Segmented label="Chart style" size="sm" options={TPS_MODES} value={mode} onChange={setMode} />
      </div>

      <div className="mt-3 h-48" role="img" aria-label={`Turns per second through solve ${number}, peaking at ${peak.toFixed(1)}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, "dataMax"]}
              tick={{ fill: colors.tick, fontSize: 10 }}
              tickFormatter={(t: number) => `${Math.round(t)}s`}
              stroke={colors.axis}
            />
            <YAxis tick={{ fill: colors.tick, fontSize: 10 }} stroke={colors.axis} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: colors.tooltipBg,
                border: colors.tooltipBorder,
                borderRadius: 8,
                color: colors.tooltipText,
                fontSize: 11,
              }}
              labelFormatter={(t) => `${Number(t).toFixed(1)}s`}
              formatter={(v) => [`${Number(v).toFixed(1)} TPS`, ""]}
            />
            {mode === "segregated" ? (
              <>
                {PHASES.map((phase) => (
                  <Area
                    key={phase}
                    dataKey={phase}
                    type="monotone"
                    stroke={PHASE_COLOR[phase]}
                    fill={PHASE_COLOR[phase]}
                    fillOpacity={0.25}
                    strokeWidth={2}
                    connectNulls={false}
                    isAnimationActive={false}
                    name={PHASE_LABEL[phase]}
                  />
                ))}
                {starts.map(({ phase, t }) => (
                  <ReferenceLine
                    key={phase}
                    x={t}
                    stroke={PHASE_COLOR[phase]}
                    strokeDasharray="4 4"
                    label={{ value: PHASE_LABEL[phase], position: "top", fill: PHASE_COLOR[phase], fontSize: 10 }}
                  />
                ))}
              </>
            ) : (
              <Area
                dataKey="all"
                type="monotone"
                stroke={colors.avgAo12}
                fill={colors.avgAo12}
                fillOpacity={0.2}
                strokeWidth={2}
                isAnimationActive={false}
                name="TPS"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function EmptyState({
  title,
  detail,
  progress,
}: {
  title: string;
  detail: string;
  progress?: number;
}) {
  return (
    <div className="surface rounded-2xl p-6 text-center">
      <p className="font-display text-base font-bold text-token">{title}</p>
      <p className="mx-auto mt-1.5 max-w-xs text-sm text-token-muted">{detail}</p>
      {progress !== undefined ? (
        <div className="mx-auto mt-4 h-1.5 max-w-40 overflow-hidden rounded-full bg-surface-strong">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(1, progress) * 100}%`, backgroundColor: "var(--kid-accent)" }}
          />
        </div>
      ) : null}
    </div>
  );
}
