"use client";

import { useState } from "react";
import {
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import type { SolvesOverTimeData } from "@/lib/analytics";
import { formatCs } from "@/lib/cubing";

interface Props { data: SolvesOverTimeData }

export function SolvesOverTime({ data }: Props) {
  const [showAo5, setShowAo5]   = useState(true);
  const [showAo12, setShowAo12] = useState(false);
  const [showAo50, setShowAo50] = useState(false);
  const [showComps, setShowComps] = useState(true);

  const { points, compMarkers } = data;
  const valid = points.filter((p) => p.timeCs > 0);

  if (!valid.length) {
    return (
      <div className="h-[240px] flex items-center justify-center text-zinc-400 text-sm">
        No practice solves yet for this event.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { key: "ao5",   label: "Ao5",    val: showAo5,   set: setShowAo5 },
          { key: "ao12",  label: "Ao12",   val: showAo12,  set: setShowAo12 },
          { key: "ao50",  label: "Ao50",   val: showAo50,  set: setShowAo50 },
          { key: "comps", label: "Comps",  val: showComps, set: setShowComps },
        ].map(({ key, label, val, set }) => (
          <button key={key} onClick={() => set((v: boolean) => !v)}
            className={`px-3 py-1 rounded-full border transition-colors ${
              val
                ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 border-transparent"
                : "border-zinc-300 dark:border-zinc-600 text-zinc-400"
            }`}
          >{label}</button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={valid} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="index" tick={{ fontSize: 11 }} label={{ value: "Solve #", position: "insideBottom", offset: -2, fontSize: 11 }} />
          <YAxis tickFormatter={(v: number) => formatCs(v)} tick={{ fontSize: 11 }} width={55} />
          <Tooltip
            formatter={(v: unknown, name: unknown) => [
              typeof v === "number" && v > 0 ? formatCs(v) : "DNF",
              String(name),
            ]}
            labelFormatter={(idx: unknown) => `Solve #${idx}`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />

          {showComps && compMarkers.map((c) => {
            // Find closest solve index to comp date
            const closest = valid.reduce((best, p) =>
              Math.abs(p.ts - c.ts) < Math.abs(best.ts - c.ts) ? p : best, valid[0]);
            return closest ? (
              <ReferenceLine key={c.ts} x={closest.index} stroke="#f59e0b"
                strokeDasharray="4 3" label={{ value: "🏆", position: "top", fontSize: 12 }} />
            ) : null;
          })}

          <Scatter dataKey="timeCs" name="Single" fill="#94a3b8" opacity={0.5} />
          {showAo5  && <Line dataKey="ao5"  name="Ao5"  type="monotone" stroke="#6366f1" strokeWidth={2} dot={false} connectNulls />}
          {showAo12 && <Line dataKey="ao12" name="Ao12" type="monotone" stroke="#14b8a6" strokeWidth={2} dot={false} connectNulls />}
          {showAo50 && <Line dataKey="ao50" name="Ao50" type="monotone" stroke="#22c55e" strokeWidth={2} dot={false} connectNulls />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
