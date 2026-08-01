"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { DistBin } from "@/lib/analytics";
import { formatCs } from "@/lib/cubing";
import { useTheme } from "@/lib/useTheme";
import { chartColors, type ChartColors } from "@/lib/chartTheme";

interface Props {
  bins: DistBin[];
  targetCs?: number | null;
  prCs?: number | null;
}

const BIN_WIDTH = 50; // must match distributionFromPoints

/** Category axes place a ReferenceLine by matching a bin's label exactly, so
 *  a raw cs value has to be resolved to whichever bin it falls in first. */
function binLabelFor(bins: DistBin[], cs: number): string | null {
  if (!bins.length) return null;
  const hit = bins.find((b) => cs >= b.binStart && cs < b.binStart + BIN_WIDTH);
  if (hit) return hit.label;
  // Outside the plotted range (e.g. target is faster than every solve so far)
  // — snap to the nearest edge bin rather than not drawing the line at all.
  const edge = cs < bins[0].binStart ? bins[0] : bins[bins.length - 1];
  return edge.label;
}

interface TooltipPayloadEntry {
  value?: number;
  payload?: { label?: string };
}

// Compact tooltip matching SolvesOverTime: time range on top, count below.
function DistTooltip({
  active,
  payload,
  colors,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  colors: ChartColors;
}) {
  if (!active || !payload?.length) return null;
  const label = payload[0]?.payload?.label;
  const count = payload[0]?.value ?? 0;
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
      {label != null && (
        <div style={{ opacity: 0.65, fontSize: 10, marginBottom: 2 }}>{label}</div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <span>Solves</span>
        <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{count}</span>
      </div>
    </div>
  );
}

export function SolveDistribution({ bins, targetCs, prCs }: Props) {
  const { theme } = useTheme();
  const cc = chartColors(theme);
  // Gold reads poorly on the light paper canvas — matches SolvesOverTime.
  const targetColor = theme === "light" ? "#C2410C" : "#FFD500";
  const prColor = "#22C55E";

  if (!bins.length) {
    return (
      <div className="h-[200px] flex items-center justify-center text-token-muted text-sm">
        Not enough solves yet.
      </div>
    );
  }

  const targetLabel = targetCs != null && targetCs > 0 ? binLabelFor(bins, targetCs) : null;
  const prLabel = prCs != null && prCs > 0 ? binLabelFor(bins, prCs) : null;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={bins} margin={{ top: 8, right: 8, left: 0, bottom: 16 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: cc.tick }}
          axisLine={{ stroke: cc.axis }}
          tickLine={{ stroke: cc.axis }}
          interval={Math.max(0, Math.floor(bins.length / 10) - 1)}
          angle={-30}
          textAnchor="end"
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 10, fill: cc.tick }}
          axisLine={{ stroke: cc.axis }}
          tickLine={{ stroke: cc.axis }}
          width={28}
        />
        <Tooltip content={<DistTooltip colors={cc} />} cursor={{ fill: cc.grid }} />

        {targetLabel != null && (
          <ReferenceLine
            x={targetLabel}
            stroke={targetColor}
            strokeDasharray="5 4"
            strokeWidth={1.5}
            label={{
              value: `Target ${formatCs(targetCs!)}`,
              position: "insideTopRight",
              fill: targetColor,
              fontSize: 10,
              fontWeight: 700,
            }}
          />
        )}
        {prLabel != null && (
          <ReferenceLine
            x={prLabel}
            stroke={prColor}
            strokeDasharray="5 4"
            strokeWidth={1.5}
            label={{
              value: `Ao5 PR ${formatCs(prCs!)}`,
              position: "insideTopLeft",
              fill: prColor,
              fontSize: 10,
              fontWeight: 700,
            }}
          />
        )}

        <Bar dataKey="count" name="Solves" fill={cc.bar} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
