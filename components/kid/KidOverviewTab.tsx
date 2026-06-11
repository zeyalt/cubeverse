"use client";

import { formatCs } from "@/lib/cubing";
import { PracticeHeatmap } from "@/components/analytics/PracticeHeatmap";

interface PbRow {
  eventId: string;
  officialSingle: number | null;
  officialAvg: number | null;
  practiceSingle: number | null;
  practiceAvg: number | null;
}

interface KidOverviewTabProps {
  data: {
    pbs: PbRow[];
    heatmap: Record<string, number>;
    totalSolves: number;
  };
}

const EVENT_NAMES: Record<string, string> = {
  "333": "3×3×3",
  "222": "2×2×2",
  pyram: "Pyraminx",
  skewb: "Skewb",
  clock: "Clock",
  "444": "4×4×4",
  "333oh": "3×3 OH",
};

function fmt(cs: number | null): string {
  if (cs === null) return "—";
  if (cs <= 0) return "DNF";
  return formatCs(cs);
}

export function KidOverviewTab({
  data: { pbs, heatmap, totalSolves },
}: KidOverviewTabProps) {
  const allPracticeSingles = pbs
    .map((p) => p.practiceSingle)
    .filter((p) => p && p > 0) as number[];
  const bestOverall =
    allPracticeSingles.length > 0 ? Math.min(...allPracticeSingles) : null;

  return (
    <div className="space-y-6 px-5 py-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-extrabold text-white">Overview</h2>
        <p className="text-sm text-white/60">Your personal bests & activity</p>
      </div>

      {/* Best overall callout */}
      {bestOverall && (
        <div
          className="sticker rounded-2xl border-2 border-[#FFD500] px-6 py-4 text-center"
          style={{ boxShadow: "4px 4px 0 #FFD500" }}
        >
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/60 mb-1">
            Your best
          </p>
          <p
            className="font-mono-time text-4xl font-bold"
            style={{ color: "#FFD500" }}
          >
            {formatCs(bestOverall)}
          </p>
        </div>
      )}

      {/* PB table by event */}
      <div className="space-y-3">
        <p className="text-sm font-bold text-white">
          Personal bests
        </p>
        <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-white/60">
                  Event
                </th>
                <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-white/60">
                  Official
                </th>
                <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-white/60">
                  Off. Avg
                </th>
                <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-white/60">
                  Practice
                </th>
                <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-white/60">
                  Prac. Avg
                </th>
              </tr>
            </thead>
            <tbody>
              {pbs.map((row, idx) => (
                <tr
                  key={row.eventId}
                  className={idx !== pbs.length - 1 ? "border-b border-white/5" : ""}
                >
                  <td className="px-4 py-3 font-medium text-white">
                    {EVENT_NAMES[row.eventId] ?? row.eventId}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-white/80">
                    {fmt(row.officialSingle)}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-white/80">
                    {fmt(row.officialAvg)}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-bold text-white">
                    {fmt(row.practiceSingle)}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-white/80">
                    {fmt(row.practiceAvg)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Heatmap */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">
            Activity
          </p>
          <span className="text-xs text-white/50">
            {totalSolves} solve{totalSolves !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="rounded-xl bg-white/8 border border-white/10 p-4">
          <PracticeHeatmap counts={heatmap} />
        </div>
      </div>
    </div>
  );
}
