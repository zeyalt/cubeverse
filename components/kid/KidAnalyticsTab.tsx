"use client";

import { useState, useTransition } from "react";
import { formatCs } from "@/lib/cubing";
import { EVENT_SHORT, getEventSticker } from "@/lib/event-theme";
import { getAnalyticsData, type AnalyticsPayload } from "@/app/actions/analytics";
import { PracticeHeatmap } from "@/components/analytics/PracticeHeatmap";
import { SolvesOverTime } from "@/components/analytics/SolvesOverTime";
import { SolveDistribution } from "@/components/analytics/SolveDistribution";
import { Consistency } from "@/components/analytics/Consistency";
import { PbStaircase } from "@/components/analytics/PbStaircase";
import { CompetitionImprovements } from "@/components/analytics/CompetitionImprovements";
import type { CurrentPb } from "@/lib/analytics";

interface Event {
  id: string;
  name: string;
  format: string;
}

interface Cube {
  id: string;
  name: string;
}

interface KidAnalyticsTabProps {
  events: Event[];
  defaultEventId: string;
  cuberId: string;
  initialAnalyticsData: AnalyticsPayload;
  pbs: CurrentPb[];
  cubes: Cube[];
}

const EVENT_NAMES: Record<string, string> = {
  "333": "3×3×3",
  "222": "2×2×2",
  pyram: "Pyraminx",
  skewb: "Skewb",
  clock: "Clock",
  "444": "4×4×4",
  "333oh": "3×3 OH",
};

function fmt(cs: number | null): string {
  if (cs === null) return "—";
  if (cs <= 0) return "DNF";
  return formatCs(cs);
}

export function KidAnalyticsTab({
  events,
  defaultEventId,
  cuberId,
  initialAnalyticsData,
  pbs,
  cubes,
}: KidAnalyticsTabProps) {
  const [subTab, setSubTab] = useState<"practice" | "competition">("practice");
  const [selectedEventId, setSelectedEventId] = useState(defaultEventId);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsPayload>(initialAnalyticsData);
  const [compTypeFilter, setCompTypeFilter] = useState<"all" | "wca" | "unofficial">("all");
  const [isPending, startTransition] = useTransition();
  const [timesOpen, setTimesOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingCs, setEditingCs] = useState<number>(0);
  const [editingPenalty, setEditingPenalty] = useState<"none" | "plus2" | "dnf">("none");

  const selected = events.find((e) => e.id === selectedEventId) ?? events[0];

  const handleEventChange = (eventId: string) => {
    setSelectedEventId(eventId);
    startTransition(async () => {
      const data = await getAnalyticsData(cuberId, eventId);
      setAnalyticsData(data);
    });
  };

  const filteredCompetitions = analyticsData.competitionImprovements.filter((comp) => {
    if (compTypeFilter === "all") return true;
    return comp.type === compTypeFilter;
  });

  return (
    <div className="px-5 py-6 pb-28 space-y-6">
      {/* Sub-tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setSubTab("practice")}
          className={`flex-1 py-2 px-3 rounded-lg font-bold transition-colors ${
            subTab === "practice"
              ? "bg-[#FFD500] text-black"
              : "bg-white/10 text-white hover:bg-white/15"
          }`}
        >
          Practice
        </button>
        <button
          onClick={() => setSubTab("competition")}
          className={`flex-1 py-2 px-3 rounded-lg font-bold transition-colors ${
            subTab === "competition"
              ? "bg-[#FFD500] text-black"
              : "bg-white/10 text-white hover:bg-white/15"
          }`}
        >
          Competition
        </button>
      </div>

      {/* Practice Sub-tab */}
      {subTab === "practice" && (
        <div className="space-y-6">
          {/* Event selector */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40">Event</p>
            <div className="flex flex-wrap gap-2">
              {events.map((e) => (
                <button
                  key={e.id}
                  onClick={() => handleEventChange(e.id)}
                  disabled={isPending}
                  className={`sticker px-4 py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-50 ${
                    selectedEventId === e.id
                      ? "bg-[#FFD500] text-black shadow-lg"
                      : "bg-white/10 text-white hover:bg-white/15"
                  }`}
                  style={
                    selectedEventId === e.id
                      ? { boxShadow: "4px 4px 0 rgba(0,0,0,0.3)" }
                      : undefined
                  }
                >
                  {EVENT_SHORT[e.id] || e.id}
                </button>
              ))}
            </div>
          </div>

          {/* Practice PBs table */}
          <div className="space-y-2">
            <p className="text-sm font-bold text-white">Practice Personal Bests</p>
            <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-white/60">
                      Event
                    </th>
                    <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-white/60">
                      Single
                    </th>
                    <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-white/60">
                      Average
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pbs.map((pb, idx) => (
                    <tr
                      key={pb.eventId}
                      className={idx !== pbs.length - 1 ? "border-b border-white/5" : ""}
                    >
                      <td className="px-4 py-3 font-medium text-white">
                        {EVENT_NAMES[pb.eventId] || pb.eventId}
                      </td>
                      <td className="px-4 py-3 text-center font-mono-time font-bold text-white">
                        {fmt(pb.practiceSingle)}
                      </td>
                      <td className="px-4 py-3 text-center font-mono-time text-white/80">
                        {fmt(pb.practiceAvg)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Practice History */}
          <div className="relative z-10">
            <button
              onClick={() => setTimesOpen(!timesOpen)}
              className="w-full flex items-center justify-between rounded-xl bg-white/8 border border-white/10 px-4 py-3 transition-colors hover:bg-white/12"
            >
              <span className="font-bold text-white">Practice History</span>
              <span className={`transition-transform ${timesOpen ? "rotate-180" : ""}`}>▼</span>
            </button>

            {timesOpen && analyticsData.heatmap && (
              <div className="mt-3 max-h-96 overflow-y-auto rounded-xl bg-white/5 border border-white/10 p-3">
                {/* Note: heatmap contains all practice solves, need to filter for this event */}
                {/* For now, show the complete grid with all times from getHistoricalSolves */}
                <div className="text-xs text-white/50 text-center py-4">
                  Practice history not yet wired. Use event selector to load data.
                </div>
              </div>
            )}
          </div>

          {/* Practice Frequency (heatmap) */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40">Practice Frequency</p>
            <div className="rounded-xl bg-white/8 border border-white/10 p-4">
              <PracticeHeatmap counts={analyticsData.heatmap} />
            </div>
          </div>

          {/* Solves Over Time */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40">Solves Over Time</p>
            <div className="rounded-xl bg-white/8 border border-white/10 p-4">
              <SolvesOverTime data={analyticsData.solvesOverTime} />
            </div>
          </div>

          {/* Solve Distribution */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40">Solve Distribution</p>
            <div className="rounded-xl bg-white/8 border border-white/10 p-4">
              <SolveDistribution bins={analyticsData.distribution} />
            </div>
          </div>

          {/* Consistency */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40">Consistency</p>
            <div className="rounded-xl bg-white/8 border border-white/10 p-4">
              <Consistency points={analyticsData.consistency} window={20} />
            </div>
          </div>
        </div>
      )}

      {/* Competition Sub-tab */}
      {subTab === "competition" && (
        <div className="space-y-6">
          {/* Event selector */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40">Event</p>
            <div className="flex flex-wrap gap-2">
              {events.map((e) => (
                <button
                  key={e.id}
                  onClick={() => handleEventChange(e.id)}
                  disabled={isPending}
                  className={`sticker px-4 py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-50 ${
                    selectedEventId === e.id
                      ? "bg-[#FFD500] text-black shadow-lg"
                      : "bg-white/10 text-white hover:bg-white/15"
                  }`}
                  style={
                    selectedEventId === e.id
                      ? { boxShadow: "4px 4px 0 rgba(0,0,0,0.3)" }
                      : undefined
                  }
                >
                  {EVENT_SHORT[e.id] || e.id}
                </button>
              ))}
            </div>
          </div>

          {/* Competition type filter */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40">Type</p>
            <div className="flex gap-2">
              {(["all", "wca", "unofficial"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setCompTypeFilter(type)}
                  className={`flex-1 py-2 px-3 rounded-lg font-bold text-sm transition-colors ${
                    compTypeFilter === type
                      ? "bg-[#FFD500] text-black"
                      : "bg-white/10 text-white hover:bg-white/15"
                  }`}
                >
                  {type === "all" ? "All" : type === "wca" ? "WCA" : "Unofficial"}
                </button>
              ))}
            </div>
          </div>

          {/* Official PBs table */}
          <div className="space-y-2">
            <p className="text-sm font-bold text-white">Official Personal Bests</p>
            <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-white/60">
                      Event
                    </th>
                    <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-white/60">
                      Single
                    </th>
                    <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-white/60">
                      Average
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pbs.map((pb, idx) => (
                    <tr
                      key={pb.eventId}
                      className={idx !== pbs.length - 1 ? "border-b border-white/5" : ""}
                    >
                      <td className="px-4 py-3 font-medium text-white">
                        {EVENT_NAMES[pb.eventId] || pb.eventId}
                      </td>
                      <td className="px-4 py-3 text-center font-mono-time font-bold text-white">
                        {fmt(pb.officialSingle)}
                      </td>
                      <td className="px-4 py-3 text-center font-mono-time text-white/80">
                        {fmt(pb.officialAvg)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* PB Staircase */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40">PB Progression</p>
            <div className="rounded-xl bg-white/8 border border-white/10 p-4">
              <PbStaircase data={analyticsData.pbStaircase} />
            </div>
          </div>

          {/* Competition Improvements */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40">Competition Improvements</p>
            <div className="rounded-xl bg-white/8 border border-white/10 p-4">
              <CompetitionImprovements data={filteredCompetitions} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
