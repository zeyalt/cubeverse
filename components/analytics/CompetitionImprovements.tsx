"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatCs } from "@/lib/cubing";
import type { CompetitionImprovement } from "@/lib/analytics";

interface CompetitionImprovementsProps {
  data: CompetitionImprovement[];
}

function Delta({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  const improved = delta < 0;
  return (
    <span className={`font-mono-time text-[11px] font-bold ${improved ? "text-green-400" : "text-red-400"}`}>
      {improved ? "−" : "+"}{formatCs(Math.abs(delta))}
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
    <div className="space-y-1.5">
      {data.map((comp, idx) => (
        <Link
          key={idx}
          href={`/competitions/${comp.competitionId}?from=analytics`}
          className="surface surface-hover flex items-center gap-3 rounded-lg px-3 py-2"
        >
          {/* Name + meta */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-bold text-white">{comp.competitionName}</p>
              <span className="shrink-0 rounded bg-white/10 px-1 py-0.5 text-[9px] font-bold uppercase text-white/50">
                {ROUND_LABELS[comp.roundType]}
              </span>
            </div>
            <p className="text-[11px] text-white/40">{comp.date}</p>
          </div>

          {/* Times — single over average, with labels + deltas */}
          <div className="shrink-0 leading-tight">
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wide text-white/35">Single</span>
              <span className="font-mono-time text-sm font-bold text-white">
                {comp.bestSingle !== null ? formatCs(comp.bestSingle) : "DNF"}
              </span>
              <Delta delta={comp.deltaSingle} />
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wide text-white/35">Avg</span>
              <span className="font-mono-time text-xs text-white/70">
                {comp.average !== null ? formatCs(comp.average) : "—"}
              </span>
              <Delta delta={comp.deltaAverage} />
            </div>
          </div>

          <ChevronRight className="size-4 shrink-0 text-white/30" />
        </Link>
      ))}
    </div>
  );
}
