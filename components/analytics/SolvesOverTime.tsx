"use client";

import { useState } from "react";
import {
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import type { SolvesOverTimeData } from "@/lib/analytics";
import { formatCs } from "@/lib/cubing";

interface Props { data: SolvesOverTimeData }

function fmtTs(ts: number): string {
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", year: "2-digit" });
}

export function SolvesOverTime({ data }: Props) {
  const [showAo5, setShowAo5]   = useState(true);
  const [showAo12, setShowAo12] = useState(false);
  const [showAo50, setShowAo50] = useState(false);
  const [showComps, setShowComps] = useState(true);
  const [xAxis, setXAxis] = useState<"index" | "ts">("index");

  const { points, compMarkers } = data;
  const valid = points.filter((p) => p.timeCs > 0);

  if (!valid.length) {
    return (
      <div className="h-80 flex items-center justify-center text-white/40 text-sm">
        No practice solves yet for this event.
      </div>
    );
  }

  const xKey = xAxis === "index" ? "index" : "ts";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        {/* X-axis toggle */}
        <div className="flex rounded-lg border border-white/20 overflow-hidden text-xs bg-white/5">
          <button
            onClick={() => setXAxis("index")}
            className={`flex min-h-9 cursor-pointer items-center px-3 py-1.5 transition-colors font-bold [touch-action:manipulation] ${xAxis === "index" ? "bg-[#FFD500] text-black" : "text-white/60 hover:text-white"}`}
          >
            Solve #
          </button>
          <button
            onClick={() => setXAxis("ts")}
            className={`flex min-h-9 cursor-pointer items-center px-3 py-1.5 transition-colors font-bold [touch-action:manipulation] ${xAxis === "ts" ? "bg-[#FFD500] text-black" : "text-white/60 hover:text-white"}`}
          >
            Date
          </button>
        </div>

        {[
          { key: "ao5",   label: "Ao5",    val: showAo5,   set: setShowAo5 },
          { key: "ao12",  label: "Ao12",   val: showAo12,  set: setShowAo12 },
          { key: "ao50",  label: "Ao50",   val: showAo50,  set: setShowAo50 },
          { key: "comps", label: "Comps",  val: showComps, set: setShowComps },
        ].map(({ key, label, val, set }) => (
          <button key={key} onClick={() => set((v: boolean) => !v)}
            className={`flex min-h-9 cursor-pointer items-center px-3 py-1.5 rounded-lg border font-bold transition-colors [touch-action:manipulation] ${
              val
                ? "bg-white/20 text-white border-white/30"
                : "border-white/10 text-white/40 hover:text-white/60"
            }`}
          >{label}</button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={valid} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="0" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickFormatter={xAxis === "ts" ? (v) => fmtTs(v) : undefined}
            label={xAxis === "index" ? { value: "Solve #", position: "insideBottom", offset: -2, fontSize: 11, fill: "rgba(255,255,255,0.4)" } : undefined}
            type={xAxis === "ts" ? "number" : "category"}
            domain={xAxis === "ts" ? ["dataMin", "dataMax"] : undefined}
            scale={xAxis === "ts" ? "time" : undefined}
          />
          <YAxis
            tickFormatter={(v: number) => formatCs(v)}
            tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            width={55}
          />
          <Tooltip
            formatter={(v: unknown, name: unknown) => [
              typeof v === "number" && v > 0 ? formatCs(v) : "DNF",
              String(name),
            ]}
            labelFormatter={(val: unknown) =>
              xAxis === "ts"
                ? new Date(Number(val)).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
                : `Solve #${val}`
            }
            contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
          />

          {showComps && compMarkers.map((c) => {
            const xVal = xAxis === "index"
              ? valid.reduce((best, p) => Math.abs(p.ts - c.ts) < Math.abs(best.ts - c.ts) ? p : best, valid[0])?.index
              : c.ts;
            return xVal != null ? (
              <ReferenceLine key={c.ts} x={xVal} stroke="rgba(255,215,0,0.3)"
                strokeDasharray="4 3" label={{ value: "🏆", position: "top", fontSize: 12 }} />
            ) : null;
          })}

          <Scatter dataKey="timeCs" name="Single" fill="rgba(255,255,255,0.15)" opacity={0.6} />
          {showAo5  && <Line dataKey="ao5"  name="Ao5"  type="natural" stroke="#FFD500" strokeWidth={3} dot={false} connectNulls isAnimationActive={false} />}
          {showAo12 && <Line dataKey="ao12" name="Ao12" type="natural" stroke="#0046AD" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />}
          {showAo50 && <Line dataKey="ao50" name="Ao50" type="natural" stroke="#009B48" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
