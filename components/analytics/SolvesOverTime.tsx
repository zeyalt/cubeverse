"use client";

import { useState, useRef, useCallback } from "react";
import {
  ComposedChart, Scatter, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { SolvesOverTimeData } from "@/lib/analytics";
import { formatCs } from "@/lib/cubing";
import { useTheme } from "@/lib/useTheme";
import { chartColors, type ChartColors } from "@/lib/chartTheme";

interface Props { data: SolvesOverTimeData; targetCs?: number | null; prCs?: number | null }

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

export function SolvesOverTime({ data, targetCs, prCs }: Props) {
  // Computed up front (no hooks involved) so the zoom-out floor below can size
  // itself to the actual history length — a fixed 25% floor left a long
  // history (Zayyan's 800+ solves) still wider than the screen at max zoom-out.
  const validForZoom = data.points.filter((p) => p.timeCs > 0);

  const [showAo5, setShowAo5]   = useState(true);
  const [showAo12, setShowAo12] = useState(false);
  const [showAo50, setShowAo50] = useState(false);

  // Zoom scales the per-point pixel width, driven by the slider below: drag it
  // toward "Compact" to condense the whole history into one screen (no
  // scrolling), or toward "Spread" to space points apart and scroll through
  // them. 1 = the original 14px/point spacing.
  const [zoom, setZoom] = useState(1);
  // Floor low enough that the whole history fits one screen width (~280px,
  // comfortably under the narrowest phone viewport) at the "Compact" end.
  const ZOOM_MIN = Math.min(0.25, 280 / ((validForZoom.length || 1) * 14));
  const ZOOM_MAX = 4;
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const applyZoom = useCallback((next: number) => {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    const el = scrollRef.current;
    // Keep the currently-centred point stationary on screen while the width
    // changes, so dragging the slider doesn't yank the view back to the left
    // edge every time.
    if (el) {
      const centerX = el.scrollLeft + el.clientWidth / 2;
      const ratio = centerX / (el.scrollWidth || 1);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setZoom(clamped);
        requestAnimationFrame(() => {
          if (!scrollRef.current) return;
          const newCenterX = ratio * scrollRef.current.scrollWidth;
          scrollRef.current.scrollLeft = newCenterX - scrollRef.current.clientWidth / 2;
        });
      });
    } else {
      setZoom(clamped);
    }
  }, [ZOOM_MIN, ZOOM_MAX]);

  // Logarithmic mapping so the 0–100 slider gives smooth, even-feeling control
  // across the whole ZOOM_MIN..ZOOM_MAX range, even though that range can span
  // more than an order of magnitude for a long history.
  const logMin = Math.log(ZOOM_MIN);
  const logMax = Math.log(ZOOM_MAX);
  const sliderPos = logMax === logMin ? 0 : ((Math.log(zoom) - logMin) / (logMax - logMin)) * 100;
  const onSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const pos = Number(e.target.value);
    applyZoom(Math.exp(logMin + (pos / 100) * (logMax - logMin)));
  }, [applyZoom, logMin, logMax]);

  const { theme } = useTheme();
  const cc = chartColors(theme);
  // Gold reads poorly on the light paper canvas — use dark orange there.
  const targetColor = theme === "light" ? "#C2410C" : "#FFD500";
  const prColor = "#22C55E";

  const { points } = data;
  const valid = points.filter((p) => p.timeCs > 0);

  if (!valid.length) {
    return (
      <div className="h-80 flex items-center justify-center text-white/40 text-sm">
        No practice solves yet for this event.
      </div>
    );
  }

  // Shared style for buttons inside the segmented (gapless) toggle groups.
  const segBtn =
    "flex min-h-8 cursor-pointer items-center px-2.5 py-1 transition-colors font-bold [touch-action:manipulation]";

  // Freeze the Y axis while the plot scrolls: render the axis in its own fixed
  // chart and the plot in a scrollable one, both pinned to the SAME y-domain and
  // geometry so they line up exactly.
  const CHART_H = 380;
  const X_AXIS_H = 26;
  const Y_AXIS_W = 40;
  const yVals: number[] = [];
  for (const p of valid) {
    if (p.timeCs > 0) yVals.push(p.timeCs);
    if (p.ao5 != null) yVals.push(p.ao5);
    if (p.ao12 != null) yVals.push(p.ao12);
    if (p.ao50 != null) yVals.push(p.ao50);
  }
  if (targetCs != null && targetCs > 0) yVals.push(targetCs);
  if (prCs != null && prCs > 0) yVals.push(prCs);
  const yLo = yVals.length ? Math.min(...yVals) : 0;
  const yHi = yVals.length ? Math.max(...yVals) : 1;
  const yPad = Math.max(1, (yHi - yLo) * 0.06);
  const yDomain: [number, number] = [0, Math.ceil(yHi + yPad)];
  const plotMinWidth = valid.length > 30 ? valid.length * 14 * zoom : undefined;

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 text-[11px]">
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

        {/* Zoom slider — drag toward Compact to fit the whole history on
            screen at once, or toward Spread to space points apart and scroll. */}
        <div className="flex flex-1 items-center gap-1.5 min-w-[110px] px-1">
          <span className="shrink-0 text-token-muted font-bold">Compact</span>
          <input
            type="range"
            min={0}
            max={100}
            step={0.5}
            value={sliderPos}
            onChange={onSliderChange}
            className="flex-1 accent-[#FFD500] [touch-action:manipulation]"
            aria-label="Zoom solves over time chart"
          />
          <span className="shrink-0 text-token-muted font-bold">Spread</span>
        </div>
      </div>

      <div className="flex">
        {/* Frozen Y axis */}
        <div className="shrink-0" style={{ width: Y_AXIS_W }}>
          <ResponsiveContainer width="100%" height={CHART_H}>
            <ComposedChart data={valid} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
              <YAxis
                tickFormatter={(v: number) => formatCs(v)}
                tick={{ fontSize: 10, fill: cc.tick }}
                axisLine={{ stroke: cc.axis }}
                width={Y_AXIS_W}
                domain={yDomain}
                allowDataOverflow
              />
              <XAxis dataKey="index" height={X_AXIS_H} tick={false} axisLine={{ stroke: cc.axis }} />
              <Scatter dataKey="timeCs" fill="transparent" isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Scrollable plot — width is driven by the zoom slider above. */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto"
          style={{ touchAction: "pan-x pan-y" }}
        >
          <div className="w-full" style={plotMinWidth ? { minWidth: `${plotMinWidth}px` } : undefined}>
            <ResponsiveContainer width="100%" height={CHART_H}>
              <ComposedChart data={valid} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="index"
                  height={X_AXIS_H}
                  tick={{ fontSize: 10, fill: cc.tick }}
                  axisLine={{ stroke: cc.axis }}
                  tickMargin={6}
                />
                <YAxis hide domain={yDomain} allowDataOverflow />
                <Tooltip content={<ChartTooltip colors={cc} />} />

                {targetCs != null && targetCs > 0 && (
                  <ReferenceLine
                    y={targetCs}
                    stroke={targetColor}
                    strokeDasharray="5 4"
                    strokeWidth={1.5}
                    label={{
                      value: `Target ${formatCs(targetCs)}`,
                      position: "insideTopLeft",
                      fill: targetColor,
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  />
                )}
                {prCs != null && prCs > 0 && (
                  <ReferenceLine
                    y={prCs}
                    stroke={prColor}
                    strokeDasharray="5 4"
                    strokeWidth={1.5}
                    label={{
                      value: `Ao5 PR ${formatCs(prCs)}`,
                      position: "insideBottomLeft",
                      fill: prColor,
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  />
                )}

                <Scatter
                  dataKey="timeCs"
                  name="Single"
                  fill={cc.scatter}
                  shape={(props: { cx?: number; cy?: number }) =>
                    props.cx != null && props.cy != null ? (
                      <circle cx={props.cx} cy={props.cy} r={1.75} fill={cc.scatter} />
                    ) : <g />
                  }
                />
                {showAo5  && <Line dataKey="ao5"  name="Ao5"  type="natural" stroke={cc.avgAo5}  strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />}
                {showAo12 && <Line dataKey="ao12" name="Ao12" type="natural" stroke={cc.avgAo12} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />}
                {showAo50 && <Line dataKey="ao50" name="Ao50" type="natural" stroke={cc.avgAo50} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
