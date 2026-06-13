"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { formatCs } from "@/lib/cubing";
import { EVENT_SHORT } from "@/lib/event-theme";
import { getAnalyticsData, type AnalyticsPayload } from "@/app/actions/analytics";
import { getHistoricalSolves, deleteSolve, updateSolve } from "@/app/actions/solve";
import { AnalyticsFilters, type DateRange } from "./AnalyticsFilters";
import { CurrentStatsCards } from "./CurrentStatsCards";
import { PracticeHeatmap } from "@/components/analytics/PracticeHeatmap";
import { SolvesOverTime } from "@/components/analytics/SolvesOverTime";
import { SolveDistribution } from "@/components/analytics/SolveDistribution";
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
  const [selectedCubeIds, setSelectedCubeIds] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [isPending, startTransition] = useTransition();
  const [timesOpen, setTimesOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingCs, setEditingCs] = useState<number>(0);
  const [editingPenalty, setEditingPenalty] = useState<"none" | "plus2" | "dnf">("none");
  const [sessionTimes, setSessionTimes] = useState<Array<{ id: string; cs: number; penalty: "none" | "plus2" | "dnf"; timestamp: number; scramble: string | null }>>([]);

  const refreshAll = useCallback(async (eventId: string) => {
    const [solves, data] = await Promise.all([
      getHistoricalSolves(cuberId, eventId),
      getAnalyticsData(cuberId, eventId),
    ]);
    setSessionTimes(solves.map((s) => ({ id: s.id, cs: s.cs, penalty: s.penalty, timestamp: s.timestamp, scramble: s.scramble })));
    setAnalyticsData(data);
  }, [cuberId]);

  // Fetch on mount and event change
  useEffect(() => {
    refreshAll(selectedEventId);
  }, [selectedEventId, refreshAll]);

  const selected = events.find((e) => e.id === selectedEventId) ?? events[0];
  const selectedPb = pbs.find((p) => p.eventId === selectedEventId);

  const handleEventChange = (eventId: string) => {
    setSelectedEventId(eventId);
  };

  const getDateRange = (range: DateRange): { start: Date; end: Date } => {
    const end = new Date();
    const start = new Date();
    switch (range) {
      case "14d":
        start.setDate(end.getDate() - 14);
        break;
      case "30d":
        start.setDate(end.getDate() - 30);
        break;
      case "60d":
        start.setDate(end.getDate() - 60);
        break;
      case "month":
        start.setDate(1);
        break;
      case "all":
        start.setFullYear(1970);
        break;
    }
    return { start, end };
  };

  const dateRangeFilter = getDateRange(dateRange);

  const filteredHeatmap = Object.entries(analyticsData.heatmap).reduce(
    (acc, [date, count]) => {
      const d = new Date(date + "T00:00:00Z");
      if (d >= dateRangeFilter.start && d <= dateRangeFilter.end) {
        acc[date] = count;
      }
      return acc;
    },
    {} as Record<string, number>
  );

  const filteredSolvesOverTime = {
    ...analyticsData.solvesOverTime,
    points: analyticsData.solvesOverTime.points.filter((p) => {
      const d = new Date(p.ts);
      return d >= dateRangeFilter.start && d <= dateRangeFilter.end;
    }),
  };

  const filteredDistribution = analyticsData.distribution; // TODO: filter if needed

  const filteredCompetitions = analyticsData.competitionImprovements.filter((comp) => {
    if (compTypeFilter === "all") return true;
    return comp.type === compTypeFilter;
  });

  return (
    <div className="px-5 py-6 pb-28 space-y-6 touch-action: manipulation" style={{ touchAction: "manipulation" }}>
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
          {/* Filters */}
          <AnalyticsFilters
            events={events}
            selectedEventId={selectedEventId}
            onEventChange={handleEventChange}
            cubes={cubes}
            selectedCubeIds={selectedCubeIds}
            onCubesChange={setSelectedCubeIds}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />

          {/* Current Stats Cards */}
          {selectedPb && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-white/40">Current Stats</p>
              <CurrentStatsCards
                single={selectedPb.practiceSingle}
                ao5={selectedPb.practiceAo5}
                ao12={selectedPb.practiceAo12}
                ao50={selectedPb.practiceAo50}
                ao100={selectedPb.practiceAo100}
                count={selectedPb.practiceCount}
              />
            </div>
          )}

          {/* Solves Over Time */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40">Solves Over Time</p>
            <div className="rounded-xl bg-white/8 border border-white/10 p-4">
              <SolvesOverTime data={filteredSolvesOverTime} />
            </div>
          </div>

          {/* Solve Distribution */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40">Solve Distribution</p>
            <div className="rounded-xl bg-white/8 border border-white/10 p-4">
              <SolveDistribution bins={filteredDistribution} />
            </div>
          </div>

          {/* Practice Frequency */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40">Practice Frequency</p>
            <div className="rounded-xl bg-white/8 border border-white/10 p-4">
              <PracticeHeatmap counts={filteredHeatmap} />
            </div>
          </div>

          {/* Practice History */}
          <div className="relative z-10">
            <button
              onClick={() => setTimesOpen(!timesOpen)}
              className="w-full flex items-center justify-between rounded-xl bg-white/8 border border-white/10 px-4 py-3 transition-colors hover:bg-white/12"
            >
              <span className="font-bold text-white">
                Practice History {sessionTimes.length > 0 && `(${sessionTimes.length})`}
              </span>
              <span className={`transition-transform ${timesOpen ? "rotate-180" : ""}`}>▼</span>
            </button>

            {timesOpen && (
              <div className="mt-3 max-h-96 overflow-y-auto rounded-xl bg-white/5 border border-white/10 p-3">
                {sessionTimes.length === 0 ? (
                  <p className="text-xs text-white/40 text-center py-4">No solves recorded yet.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {sessionTimes.map((time, idx) => {
                      const date = new Date(time.timestamp);
                      const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                      const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric" });
                      let longPressTimer: NodeJS.Timeout | null = null;
                      const openEdit = () => { setEditingIdx(idx); setEditingCs(time.cs); setEditingPenalty(time.penalty); };
                      return (
                        <button
                          key={idx}
                          onMouseDown={() => { longPressTimer = setTimeout(openEdit, 500); }}
                          onMouseUp={() => { if (longPressTimer) clearTimeout(longPressTimer); }}
                          onMouseLeave={() => { if (longPressTimer) clearTimeout(longPressTimer); }}
                          onTouchStart={() => { longPressTimer = setTimeout(openEdit, 500); }}
                          onTouchEnd={() => { if (longPressTimer) clearTimeout(longPressTimer); }}
                          onContextMenu={(e) => { e.preventDefault(); openEdit(); }}
                          className="flex flex-col items-center rounded-lg bg-white/8 px-2 py-2 text-center text-xs active:bg-white/12 transition-colors"
                        >
                          <p className="text-[10px] text-white/50">{dateStr} {timeStr}</p>
                          <p className="font-mono-time font-bold text-white mt-1">
                            {time.penalty === "dnf" ? "DNF" : time.penalty === "plus2" ? `${formatCs(time.cs + 200)}+` : formatCs(time.cs)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Edit Modal */}
            {editingIdx !== null && (() => {
              const solve = sessionTimes[editingIdx];
              return (
                <>
                  <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setEditingIdx(null)} />
                  <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none">
                    <div className="bg-[#1C1916] rounded-2xl border-2 border-white/20 p-6 max-w-sm w-full pointer-events-auto space-y-4">
                      <h3 className="font-display text-xl font-bold text-white text-center">Edit Timing</h3>

                      {/* Scramble */}
                      {solve?.scramble && (
                        <div className="rounded-lg bg-white/5 px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Scramble</p>
                          <p className="font-mono-time text-xs text-white/70 leading-relaxed">{solve.scramble}</p>
                        </div>
                      )}

                      {/* Time input in XX.XX format */}
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-white/60">Time</label>
                        <input
                          type="text"
                          value={(editingCs / 100).toFixed(2)}
                          onChange={(e) => {
                            const parsed = parseFloat(e.target.value);
                            if (!isNaN(parsed) && parsed >= 0) setEditingCs(Math.round(parsed * 100));
                          }}
                          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white font-mono-time text-center text-lg"
                        />
                      </div>

                      {/* Penalty */}
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-white/60">Penalty</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["none", "plus2", "dnf"] as const).map((p) => (
                            <button
                              key={p}
                              onClick={() => setEditingPenalty(p)}
                              className={`py-2 rounded-lg font-bold transition-colors ${editingPenalty === p ? "bg-[#FFD500] text-black" : "bg-white/10 text-white hover:bg-white/20"}`}
                            >
                              {p === "dnf" ? "DNF" : p === "plus2" ? "+2" : "OK"}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <button onClick={() => setEditingIdx(null)} className="py-2 rounded-lg bg-white/10 text-white font-bold hover:bg-white/20">Cancel</button>
                        <button
                          onClick={async () => {
                            const solveId = solve.id;
                            const cs = editingCs;
                            const pen = editingPenalty;
                            const evId = selectedEventId;
                            setEditingIdx(null);
                            await updateSolve(solveId, cs, pen);
                            await refreshAll(evId);
                          }}
                          className="py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={async () => {
                            const solveId = solve.id;
                            const evId = selectedEventId;
                            setEditingIdx(null);
                            await deleteSolve(solveId);
                            await refreshAll(evId);
                          }}
                          className="col-span-2 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
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
