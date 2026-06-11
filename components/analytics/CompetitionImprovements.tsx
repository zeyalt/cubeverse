"use client";

import { formatCs } from "@/lib/cubing";
import type { CompetitionImprovement } from "@/lib/analytics";

interface CompetitionImprovementsProps {
  data: CompetitionImprovement[];
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-white/40">—</span>;
  const isImprovement = delta < 0;
  const abs = Math.abs(delta);
  const color = isImprovement ? "text-green-400" : "text-red-400";
  const sign = isImprovement ? "−" : "+";
  return (
    <span className={`${color} font-mono-time font-bold`}>
      {sign}{formatCs(abs)}
    </span>
  );
}

const ROUND_LABELS: Record<string, string> = {
  first: "R1",
  second: "R2",
  semi: "SF",
  final: "F",
};

export function CompetitionImprovements({ data }: CompetitionImprovementsProps) {
  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-white/40 text-sm">
        No competitions recorded for this event.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((comp, idx) => (
        <div
          key={idx}
          className="sticker rounded-lg border border-white/10 bg-white/8 p-4 space-y-2"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-white">{comp.competitionName}</p>
              <p className="text-xs text-white/50">{comp.date}</p>
            </div>
            <div className="flex gap-1">
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-white/15 text-white/70 uppercase">
                {comp.type === "wca" ? "WCA" : "Unofficial"}
              </span>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-white/20 text-white/60 uppercase">
                {ROUND_LABELS[comp.roundType]}
              </span>
            </div>
          </div>

          {/* Single row */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60">Single</span>
            <div className="flex items-center gap-2">
              {comp.bestSingle !== null ? (
                <span className="font-mono-time font-bold text-white">{formatCs(comp.bestSingle)}</span>
              ) : (
                <span className="text-white/40">DNF</span>
              )}
              <DeltaBadge delta={comp.deltaSingle} />
            </div>
          </div>

          {/* Average row */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60">Average</span>
            <div className="flex items-center gap-2">
              {comp.average !== null ? (
                <span className="font-mono-time font-bold text-white">{formatCs(comp.average)}</span>
              ) : (
                <span className="text-white/40">DNF</span>
              )}
              <DeltaBadge delta={comp.deltaAverage} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
