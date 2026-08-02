"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import type { BenchmarkPerson } from "@/app/actions/benchmark";
import { formatCs, DNF } from "@/lib/cubing";
import { COMPETITOR_PALETTE } from "@/lib/chartTheme";

interface Props {
  people: BenchmarkPerson[];
  mode: "single" | "average";
}

interface TooltipPayloadEntry {
  name?: string;
  value?: number;
  color?: string;
  payload?: { date?: string };
}

function ChartTooltip({
  active,
  payload,
  names,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  names: Set<string>;
}) {
  if (!active || !payload?.length) return null;
  const date = payload[0]?.payload?.date;
  const rows = payload.filter((e) => e.name && names.has(e.name));
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
      {date && <div style={{ opacity: 0.65, fontSize: 10, marginBottom: 2 }}>{date}</div>}
      {rows.map((entry, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <span style={{ color: entry.color ?? "#fff" }}>{entry.name}</span>
          <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {typeof entry.value === "number" ? formatCs(entry.value) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CompetitorProgressChart({ people, mode }: Props) {
  const key = mode === "single" ? "bestCs" : "averageCs";

  // Build one merged, ts-sorted dataset with one field per person, skipping
  // DNF/missing values for the active mode rather than plotting a dip to -1.
  const merged: Record<number, Record<string, number | string>> = {};
  for (const person of people) {
    for (const p of person.points) {
      const value = key === "bestCs" ? p.bestCs : p.averageCs;
      if (value === null || value === DNF) continue;
      if (!merged[p.ts]) merged[p.ts] = { ts: p.ts, date: p.date };
      merged[p.ts][person.wcaId] = value;
    }
  }
  const chartData = Object.values(merged).sort((a, b) => (a.ts as number) - (b.ts as number));

  const names = new Set(people.map((p) => p.name));

  if (!chartData.length) {
    return (
      <div className="h-[200px] flex items-center justify-center text-center text-sm text-white/50 px-4">
        No {mode === "single" ? "single" : "average"} results found for this event yet.
      </div>
    );
  }

  const values = chartData.flatMap((row) =>
    Object.entries(row)
      .filter(([k, v]) => k !== "ts" && k !== "date" && typeof v === "number")
      .map(([, v]) => v as number)
  );
  const minTime = Math.min(...values);

  return (
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
          tickFormatter={formatCs}
          domain={[Math.floor(minTime * 0.9), "auto"]}
          tick={{ fontSize: 10 }}
          width={40}
        />
        <Tooltip content={<ChartTooltip names={names} />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {people.map((person, i) => (
          <Line
            key={person.wcaId}
            dataKey={person.wcaId}
            name={person.name}
            type="monotone"
            stroke={COMPETITOR_PALETTE[i % COMPETITOR_PALETTE.length]}
            strokeWidth={2}
            dot={{ r: 4, fill: COMPETITOR_PALETTE[i % COMPETITOR_PALETTE.length] }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
