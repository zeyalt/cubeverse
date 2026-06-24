"use client";

import { useState } from "react";
import {
  ComposedChart, Scatter, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { SolvesOverTimeData } from "@/lib/analytics";
import { formatCs } from "@/lib/cubing";
import { useTheme } from "@/lib/useTheme";
import { chartColors, type ChartColors } from "@/lib/chartTheme";

interface Props { data: SolvesOverTimeData; targetCs?: number | null }

// Custom SVG marker for competition reference lines — a small filled dot at the
// top of the line, replacing the previous emoji label for a cleaner look.
function CompMarkerLabel({ viewBox, stroke }: { viewBox?: { x?: number; y?: number }; stroke?: string }) {
  const x = viewBox?.x ?? 0;
  const y = viewBox?.y ?? 0;
  return <circle cx={x} cy={y + 4} r={3.5} fill="#FFD500" stroke={stroke ?? "#0A0A0A"} strokeWidth={1} />;
}

function fmtTs(ts: number): string {
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", year: "2-digit" });
}

interface TooltipPayloadEntry {
  name?: string;
  value?: number;
  color?: string;
  payload?: { ts?: number };
}

// Compact tooltip: solve date/time on top, then each visible series' time.
function ChartTooltip({
  active,
  payload,
  colors,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  colors: ChartColors;
}) {
  if (!active || !payload?.length) return null;
  const ts = payload[0]?.payload?.ts;
  // Only show the actual time series — not the x-axis "index" key Recharts adds.
  const SERIES = new Set(["Single", "Ao5", "Ao12", "Ao50"]);
  const rows = payload.filter((e) => e.name && SERIES.has(e.name));
  if (!rows.length) return null;
  return (
    <div
      style={{
        backgroundColor: colors.tooltipBg,
        border: colors.tooltipBorder,
        borderRadius: 8,
        color: colors.tooltipText,
        padding: "5px 8px",
        fontSize: 11,
        lineHeight: 1.35,
      }}
    >
      {ts != null && (
        <div style={{ opacity: 0.65, fontSize: 10, marginBottom: 2 }}>
          {new Date(ts).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
        </div>
      )}
      {rows.map((entry, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <span style={{ color: entry.color ?? colors.tooltipText }}>{entry.name}</span>
          <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {typeof entry.value === "number" && entry.value > 0 ? formatCs(entry.value) : "DNF"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SolvesOverTime({ data, targetCs }: Props) {
  const [showAo5, setShowAo5]   = useState(true);
  const [showAo12, setShowAo12] = useState(false);
  const [showAo50, setShowAo50] = useState(false);
  const [showComps, setShowComps] = useState(true);
  const [xAxis, setXAxis] = useState<"index" | "ts">("index");
  const { theme } = useTheme();
  const cc = chartColors(theme);

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

  // Shared style for buttons inside the segmented (gapless) toggle groups.
  const segBtn =
    "flex min-h-8 cursor-pointer items-center px-2.5 py-1 transition-colors font-bold [touch-action:manipulation]";

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 text-[11px]">
        {/* X-axis toggle */}
        <div className="flex rounded-lg border border-token overflow-hidden text-xs bg-surface">
          <button
            onClick={() => setXAxis("index")}
            className={`${segBtn} ${xAxis === "index" ? "bg-[#FFD500] text-black" : "text-token-muted"}`}
          >
            Solve #
          </button>
          <button
            onClick={() => setXAxis("ts")}
            className={`${segBtn} ${xAxis === "ts" ? "bg-[#FFD500] text-black" : "text-token-muted"}`}
          >
            Date
          </button>
        </div>

        {/* Average toggles — gapless segmented group; each uses its line colour */}
        <div className="flex rounded-lg border border-token overflow-hidden text-xs bg-surface">
          {([
            { key: "ao5",  label: "Ao5",  val: showAo5,  set: setShowAo5,  active: "bg-[#FFD500] text-black" },
            { key: "ao12", label: "Ao12", val: showAo12, set: setShowAo12, active: "bg-[#0046AD] text-white" },
            { key: "ao50", label: "Ao50", val: showAo50, set: setShowAo50, active: "bg-[#009B48] text-white" },
          ] as const).map(({ key, label, val, set, active }) => (
            <button key={key} onClick={() => set((v: boolean) => !v)}
              className={`${segBtn} ${val ? active : "text-token-muted"}`}
            >{label}</button>
          ))}
        </div>

        {/* Competition markers */}
        <button onClick={() => setShowComps((v) => !v)}
          className={`flex min-h-8 cursor-pointer items-center px-2.5 py-1 rounded-lg border font-bold transition-colors [touch-action:manipulation] ${
            showComps ? "bg-[#FFD500] text-black border-[#FFD500]" : "bg-surface text-token-muted border-token"
          }`}
        >Comps</button>
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={valid} margin={{ top: 8, right: 8, left: 0, bottom: 18 }}>
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 10, fill: cc.tick }}
            axisLine={{ stroke: cc.axis }}
            tickMargin={6}
            tickFormatter={xAxis === "ts" ? (v) => fmtTs(v) : undefined}
            label={xAxis === "index" ? { value: "Solve #", position: "insideBottom", offset: -12, fontSize: 11, fill: cc.tick } : undefined}
            type={xAxis === "ts" ? "number" : "category"}
            domain={xAxis === "ts" ? ["dataMin", "dataMax"] : undefined}
            scale={xAxis === "ts" ? "time" : undefined}
          />
          <YAxis
            tickFormatter={(v: number) => formatCs(v)}
            tick={{ fontSize: 11, fill: cc.tick }}
            axisLine={{ stroke: cc.axis }}
            width={55}
          />
          <Tooltip content={<ChartTooltip colors={cc} />} />

          {targetCs != null && targetCs > 0 && (
            <ReferenceLine
              y={targetCs}
              stroke="#FFD500"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              label={{
                value: `Target ${formatCs(targetCs)}`,
                position: "insideTopRight",
                fill: "#FFD500",
                fontSize: 10,
                fontWeight: 700,
              }}
            />
          )}

          {showComps && compMarkers.map((marker) => {
            const xVal = xAxis === "index"
              ? valid.reduce((best, p) => Math.abs(p.ts - marker.ts) < Math.abs(best.ts - marker.ts) ? p : best, valid[0])?.index
              : marker.ts;
            return xVal != null ? (
              <ReferenceLine key={marker.ts} x={xVal} stroke="rgba(255,215,0,0.4)"
                strokeDasharray="4 3" label={<CompMarkerLabel stroke={cc.markerStroke} />} />
            ) : null;
          })}

          <Scatter
            dataKey="timeCs"
            name="Single"
            fill={cc.scatter}
            shape={(props: { cx?: number; cy?: number }) =>
              props.cx != null && props.cy != null ? (
                <circle cx={props.cx} cy={props.cy} r={3} fill={cc.scatter} />
              ) : <g />
            }
          />
          {showAo5  && <Line dataKey="ao5"  name="Ao5"  type="natural" stroke="#FFD500" strokeWidth={3} dot={false} connectNulls isAnimationActive={false} />}
          {showAo12 && <Line dataKey="ao12" name="Ao12" type="natural" stroke="#0046AD" strokeWidth={3} dot={false} connectNulls isAnimationActive={false} />}
          {showAo50 && <Line dataKey="ao50" name="Ao50" type="natural" stroke="#009B48" strokeWidth={3} dot={false} connectNulls isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
