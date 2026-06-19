"use client";

import { formatCs } from "@/lib/cubing";

interface Metric {
  label: string;
  value: string;
  trend?: "up" | "down" | null;
  trendPercent?: number;
}

interface CurrentStatsCardsProps {
  single: number | null;
  ao5: number | null;
  ao12: number | null;
  ao50: number | null;
  ao100: number | null;
  count: number;
  trends?: {
    single?: "up" | "down" | null;
    ao5?: "up" | "down" | null;
    ao12?: "up" | "down" | null;
    ao50?: "up" | "down" | null;
    ao100?: "up" | "down" | null;
  };
}

function fmt(cs: number | null): string {
  if (cs === null) return "—";
  if (cs <= 0) return "DNF";
  return formatCs(cs);
}

export function CurrentStatsCards({
  single,
  ao5,
  ao12,
  ao50,
  ao100,
  count,
  trends = {},
}: CurrentStatsCardsProps) {
  const metrics: Metric[] = [
    { label: "Single", value: fmt(single), trend: trends.single },
    { label: "Ao5", value: fmt(ao5), trend: trends.ao5 },
    { label: "Ao12", value: fmt(ao12), trend: trends.ao12 },
    { label: "Ao50", value: fmt(ao50), trend: trends.ao50 },
    { label: "Ao100", value: fmt(ao100), trend: trends.ao100 },
    { label: "Count", value: String(count), trend: null },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="surface relative overflow-hidden px-3 py-2.5"
        >
          <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">
              {metric.label}
            </p>
            <div className="flex items-baseline justify-between">
              <p className="font-mono-time font-bold text-white text-sm leading-tight">
                {metric.value}
              </p>
              {metric.trend && (
                <span className={`text-[10px] font-bold ${metric.trend === "down" ? "text-green-400" : "text-red-400"}`}>
                  {metric.trend === "down" ? "↓" : "↑"}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
