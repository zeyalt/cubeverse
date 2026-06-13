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
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="sticker rounded-xl border-2 border-white/10 bg-gradient-to-br from-white/8 to-white/4 px-4 py-4 relative overflow-hidden"
        >
          {/* Decorative accent */}
          <div className="absolute -top-1 -right-1 w-16 h-16 bg-[#FFD500]/5 rounded-full blur-2xl" />

          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2">
              {metric.label}
            </p>
            <div className="flex items-baseline justify-between">
              <p className="font-mono-time font-bold text-white text-lg leading-tight">
                {metric.value}
              </p>
              {metric.trend && (
                <span className={`text-sm font-bold ${metric.trend === "down" ? "text-green-400" : "text-red-400"}`}>
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
