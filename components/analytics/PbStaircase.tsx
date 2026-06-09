"use client";

import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import type { PbStaircaseData, PbPoint } from "@/lib/analytics";
import { formatCs } from "@/lib/cubing";

interface Props { data: PbStaircaseData }

function fmtY(cs: number) { return formatCs(cs); }

// Merge two series into a unified X domain for the step chart
function buildSeries(points: PbPoint[], label: string) {
  if (!points.length) return [];
  // Recharts step chart: each point carries its own value; add a future point for the final step
  const last = points[points.length - 1];
  return [...points, { ...last, ts: Date.now() + 1 }].map((p) => ({
    ts: p.ts, date: p.date, [label]: p.timeCs,
  }));
}

export function PbStaircase({ data }: Props) {
  const [showSingle, setShowSingle] = useState(true);
  const [showAvg, setShowAvg] = useState(true);

  const hasPractice = data.practiceSingle.length > 0 || data.practiceAvg.length > 0;
  const hasOfficial = data.officialSingle.length > 0 || data.officialAvg.length > 0;

  if (!hasPractice && !hasOfficial) {
    return <Empty>No PB history yet. Run a solve or import WCA data.</Empty>;
  }

  // Combine all points into one timeline
  const allPoints = [
    ...buildSeries(data.practiceSingle, "practiceSingle"),
    ...buildSeries(data.practiceAvg, "practiceAvg"),
    ...buildSeries(data.officialSingle, "officialSingle"),
    ...buildSeries(data.officialAvg, "officialAvg"),
  ].sort((a, b) => a.ts - b.ts);

  // Merge by ts into one array for Recharts
  const merged: Record<number, Record<string, number | string>> = {};
  for (const p of allPoints) {
    if (!merged[p.ts]) merged[p.ts] = { ts: p.ts, date: (p as Record<string, unknown>).date as string ?? "" };
    Object.assign(merged[p.ts], p);
  }
  const chartData = Object.values(merged).sort((a, b) => (a.ts as number) - (b.ts as number));

  const minTime = Math.min(
    ...allPoints.flatMap((p) =>
      Object.entries(p)
        .filter(([k, v]) => k !== "ts" && k !== "date" && typeof v === "number")
        .map(([, v]) => v as number)
    )
  );

  return (
    <div className="space-y-3">
      {/* Toggles */}
      <div className="flex flex-wrap gap-2 text-xs">
        {["single", "average"].map((t) => (
          <button
            key={t}
            onClick={() => t === "single" ? setShowSingle((v) => !v) : setShowAvg((v) => !v)}
            className={`px-3 py-1 rounded-full border transition-colors ${
              (t === "single" ? showSingle : showAvg)
                ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 border-transparent"
                : "border-zinc-300 dark:border-zinc-600 text-zinc-400"
            }`}
          >
            {t === "single" ? "Single" : "Average"}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="ts"
            type="number"
            domain={["dataMin", "dataMax"]}
            scale="time"
            tickFormatter={(ts: number) =>
              new Date(ts).toLocaleDateString("en-GB", { month: "short", year: "2-digit" })
            }
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tickFormatter={fmtY}
            domain={[Math.floor(minTime * 0.9), "auto"]}
            tick={{ fontSize: 11 }}
            width={55}
          />
          <Tooltip
            formatter={(v: unknown, name: unknown) => [
              typeof v === "number" ? formatCs(v) : "—",
              String(name).replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
            ]}
            labelFormatter={(ts: unknown) =>
              typeof ts === "number"
                ? new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                : String(ts)
            }
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {showSingle && hasPractice && (
            <Line dataKey="practiceSingle" name="Practice Single" type="stepAfter"
              stroke="#6366f1" strokeWidth={2} dot={false} connectNulls />
          )}
          {showAvg && hasPractice && (
            <Line dataKey="practiceAvg" name="Practice Avg" type="stepAfter"
              stroke="#6366f1" strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls />
          )}
          {showSingle && hasOfficial && (
            <Line dataKey="officialSingle" name="Official Single" type="stepAfter"
              stroke="#f59e0b" strokeWidth={2} dot={{ r: 4, fill: "#f59e0b" }} connectNulls />
          )}
          {showAvg && hasOfficial && (
            <Line dataKey="officialAvg" name="Official Avg" type="stepAfter"
              stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3"
              dot={{ r: 4, fill: "#f59e0b" }} connectNulls />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[200px] flex items-center justify-center text-zinc-400 text-sm">
      {children}
    </div>
  );
}
