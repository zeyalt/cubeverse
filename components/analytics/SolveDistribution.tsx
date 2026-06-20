"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import type { DistBin } from "@/lib/analytics";
import { useTheme } from "@/lib/useTheme";
import { chartColors, type ChartColors } from "@/lib/chartTheme";

interface Props { bins: DistBin[] }

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

export function SolveDistribution({ bins }: Props) {
  const { theme } = useTheme();
  const cc = chartColors(theme);

  if (!bins.length) {
    return (
      <div className="h-[200px] flex items-center justify-center text-token-muted text-sm">
        Not enough solves yet.
      </div>
    );
  }

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
          tick={{ fontSize: 11, fill: cc.tick }}
          axisLine={{ stroke: cc.axis }}
          tickLine={{ stroke: cc.axis }}
        />
        <Tooltip content={<DistTooltip colors={cc} />} cursor={{ fill: cc.grid }} />
        <Bar dataKey="count" name="Solves" fill={cc.bar} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
