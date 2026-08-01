"use client";

import { formatCs } from "@/lib/cubing";

interface Metric {
  label: string;
  value: string;
  trend?: "up" | "down" | null;
}

interface CurrentStatsCardsProps {
  single: number | null;
  ao5: number | null;
  ao12: number | null;
  ao50: number | null;
  ao100: number | null;
  count: number;
  wcaSingle?: number | null;
  wcaAo5?: number | null;
  trends?: {
    single?: "up" | "down" | null;
    ao5?: "up" | "down" | null;
    ao12?: "up" | "down" | null;
    ao50?: "up" | "down" | null;
    ao100?: "up" | "down" | null;
  };
}

function fmt(cs: number | null | undefined): string {
  if (cs == null) return "—";
  if (cs <= 0) return "DNF";
  return formatCs(cs);
}

function StatCard({ metric, accent }: { metric: Metric; accent?: boolean }) {
  return (
    <div
      className={`surface relative overflow-hidden px-3 py-2.5 ${
        accent ? "border-2 border-[#FFD500]/40 bg-[#FFD500]/[0.06]" : ""
      }`}
    >
      <div className="relative z-10">
        <p
          className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
            accent ? "text-[#FFD500]/80" : "text-white/40"
          }`}
        >
          {metric.label}
        </p>
        <div className="flex items-baseline justify-between">
          <p
            className={`font-mono-time font-bold text-sm leading-tight ${
              accent ? "text-[#FFD500]" : "text-white"
            }`}
          >
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
  );
}

export function CurrentStatsCards({
  single,
  ao5,
  ao12,
  ao50,
  ao100,
  count,
  wcaSingle,
  wcaAo5,
  trends = {},
}: CurrentStatsCardsProps) {
  // Column 1 is the official WCA PRs — set apart from the practice-session
  // metrics in the other three columns with an accent border/tint so it
  // doesn't read as just another practice stat.
  const wcaColumn: Metric[] = [
    { label: "WCA Single PR", value: fmt(wcaSingle) },
    { label: "WCA Ao5 PR", value: fmt(wcaAo5) },
  ];
  const practiceColumns: Metric[][] = [
    [
      { label: "Single", value: fmt(single), trend: trends.single },
      { label: "Ao5", value: fmt(ao5), trend: trends.ao5 },
    ],
    [
      { label: "Ao12", value: fmt(ao12), trend: trends.ao12 },
      { label: "Ao50", value: fmt(ao50), trend: trends.ao50 },
    ],
    [
      { label: "Ao100", value: fmt(ao100), trend: trends.ao100 },
      { label: "Count", value: String(count) },
    ],
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      <div className="space-y-2">
        {wcaColumn.map((metric) => (
          <StatCard key={metric.label} metric={metric} accent />
        ))}
      </div>
      {practiceColumns.map((col, i) => (
        <div key={i} className="space-y-2">
          {col.map((metric) => (
            <StatCard key={metric.label} metric={metric} />
          ))}
        </div>
      ))}
    </div>
  );
}
