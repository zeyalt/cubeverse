"use client";

import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import type { PbStaircaseData, PbPoint } from "@/lib/analytics";
import { formatCs } from "@/lib/cubing";

interface Props { data: PbStaircaseData }

function fmtY(cs: number) { return formatCs(cs); }

interface TooltipPayloadEntry {
  name?: string;
  value?: number;
  color?: string;
  payload?: { date?: string };
}

// Compact tooltip: competition date on top, then each visible series' time.
function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}) {
  if (!active || !payload?.length) return null;
  const date = payload[0]?.payload?.date;
  const SERIES = new Set(["Single", "Average"]);
  const rows = payload.filter((e) => e.name && SERIES.has(e.name));
  if (!rows.length) return null;
  return (
    <div
      style={{
        backgroundColor: "rgba(0,0,0,0.85)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 8,
        color: "#fff",
        padding: "5px 8px",
        fontSize: 11,
        lineHeight: 1.35,
      }}
    >
      {date && (
        <div style={{ opacity: 0.65, fontSize: 10, marginBottom: 2 }}>{date}</div>
      )}
      {rows.map((entry, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <span style={{ color: entry.color ?? "#fff" }}>{entry.name}</span>
          <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {typeof entry.value === "number" && entry.value > 0 ? formatCs(entry.value) : "DNF"}
          </span>
        </div>
      ))}
    </div>
  );
}

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

  const hasOfficial = data.officialSingle.length > 0 || data.officialAvg.length > 0;

  if (!hasOfficial) {
    return <Empty>No competition PB history yet.</Empty>;
  }

  // Combine all points into one timeline
  const allPoints = [
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
            className={`px-3 py-1 rounded-full border font-bold transition-colors ${
              (t === "single" ? showSingle : showAvg)
                ? "bg-[#FFD500] text-[#1A1208] border-transparent"
                : "border-white/20 text-white/50 hover:bg-white/10"
            }`}
          >
            {t === "single" ? "Single" : "Average"}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {showSingle && hasOfficial && (
            <Line dataKey="officialSingle" name="Single" type="stepAfter"
              stroke="#f59e0b" strokeWidth={2} dot={{ r: 4, fill: "#f59e0b" }} connectNulls />
          )}
          {showAvg && hasOfficial && (
            <Line dataKey="officialAvg" name="Average" type="stepAfter"
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
