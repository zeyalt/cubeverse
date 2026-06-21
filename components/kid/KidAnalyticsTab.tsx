"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { setEventCookie } from "@/lib/eventCookie";
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
import { EventIcon } from "./EventIcon";
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
  const searchParams = useSearchParams();
  const [subTab, setSubTab] = useState<"practice" | "competition">(
    searchParams.get("sub") === "competition" ? "competition" : "practice"
  );
  const [selectedEventId, setSelectedEventId] = useState(defaultEventId);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsPayload>(initialAnalyticsData);
  const [selectedCubeIds, setSelectedCubeIds] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<DateRange>("all");
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

  // Fetch on mount and event change — this effect synchronises with an external
  // system (the database), so the setState inside refreshAll is intentional.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshAll(selectedEventId);
  }, [selectedEventId, refreshAll]);

  const selectedPb = pbs.find((p) => p.eventId === selectedEventId);

  const handleEventChange = (eventId: string) => {
    setSelectedEventId(eventId);
    setEventCookie(eventId); // share selection with practice / cubes / timer
  };

  const toLocalYMD = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const getDateRange = (range: DateRange): { startStr: string; endStr: string } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);

    switch (range) {
      case "14d":
        start.setDate(start.getDate() - 13); // 14 days includes today
        break;
      case "30d":
        start.setDate(start.getDate() - 29);
        break;
      case "60d":
        start.setDate(start.getDate() - 59);
        break;
      case "month":
        start.setDate(1);
        break;
      case "all":
        start.setFullYear(1970);
        break;
    }

    return { startStr: toLocalYMD(start), endStr: toLocalYMD(today) };
  };

  const dateRangeFilter = getDateRange(dateRange);

  const filteredSolvesOverTime = {
    ...analyticsData.solvesOverTime,
    points: analyticsData.solvesOverTime.points.filter((p) => {
      const dateStr = toLocalYMD(new Date(p.ts));
      return dateStr >= dateRangeFilter.startStr && dateStr <= dateRangeFilter.endStr;
    }),
  };

  const filteredDistribution = analyticsData.distribution; // TODO: filter if needed

  return (
    <div className="px-5 pt-3 pb-4 space-y-5" style={{ touchAction: "manipulation" }}>
      {/* Page title */}
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-white">Analytics</h2>

      {/* Sub-tab switcher — segmented control */}
      <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
        <button
          onClick={() => setSubTab("practice")}
          className={`flex min-h-9 flex-1 items-center justify-center rounded-lg px-3 text-sm font-bold transition-colors [touch-action:manipulation] ${
            subTab === "practice"
              ? "bg-[#FFD500] text-black"
              : "text-white/60 hover:text-white"
          }`}
        >
          Practice
        </button>
        <button
          onClick={() => setSubTab("competition")}
          className={`flex min-h-9 flex-1 items-center justify-center rounded-lg px-3 text-sm font-bold transition-colors [touch-action:manipulation] ${
            subTab === "competition"
              ? "bg-[#FFD500] text-black"
              : "text-white/60 hover:text-white"
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
            <div className="surface p-4">
              <SolvesOverTime data={filteredSolvesOverTime} targetCs={analyticsData.targetCs} />
            </div>
          </div>

          {/* Solve Distribution */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40">Solve Distribution</p>
            <div className="surface p-4">
              <SolveDistribution bins={filteredDistribution} />
            </div>
          </div>

          {/* Practice Frequency */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40">Practice Frequency</p>
            <div className="surface px-4 py-6">
              <PracticeHeatmap
                counts={analyticsData.heatmap}
                startDate={dateRange === "all" ? undefined : dateRangeFilter.startStr}
                endDate={dateRange === "all" ? undefined : dateRangeFilter.endStr}
              />
            </div>
          </div>

          {/* Practice History */}
          <div className="relative z-10">
            <button
              onClick={() => setTimesOpen(!timesOpen)}
              className="surface surface-hover w-full flex items-center justify-between px-4 py-3"
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
          {/* ── All-events overview ─────────────────────────────────────── */}
          <div className="space-y-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white/40">Personal Records</p>
              <p className="text-[11px] text-white/35">Best results across all events</p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th rowSpan={2} className="px-4 py-3 text-left align-bottom font-bold uppercase tracking-wider text-white/60">
                      Event
                    </th>
                    <th colSpan={2} className="px-4 py-2 text-center font-bold uppercase tracking-wider text-white/60">
                      WCA
                    </th>
                    <th colSpan={2} className="px-4 py-2 text-center font-bold uppercase tracking-wider text-white/60 border-l border-white/10">
                      Non-WCA
                    </th>
                  </tr>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-2 text-center font-bold uppercase tracking-wider text-white/40">
                      Single
                    </th>
                    <th className="px-4 py-2 text-center font-bold uppercase tracking-wider text-white/40">
                      Average
                    </th>
                    <th className="px-4 py-2 text-center font-bold uppercase tracking-wider text-white/40 border-l border-white/10">
                      Single
                    </th>
                    <th className="px-4 py-2 text-center font-bold uppercase tracking-wider text-white/40">
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
                        <span className="flex items-center gap-2">
                          <EventIcon event={pb.eventId} className="shrink-0 text-base text-white/70" />
                          {EVENT_NAMES[pb.eventId] || pb.eventId}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono-time font-bold text-white">
                        {fmt(pb.wcaSingle)}
                      </td>
                      <td className="px-4 py-3 text-center font-mono-time text-white/80">
                        {fmt(pb.wcaAvg)}
                      </td>
                      <td className="px-4 py-3 text-center font-mono-time font-bold text-white border-l border-white/10">
                        {fmt(pb.unofficialSingle)}
                      </td>
                      <td className="px-4 py-3 text-center font-mono-time text-white/80">
                        {fmt(pb.unofficialAvg)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Per-event progress ──────────────────────────────────────── */}
          <div className="border-t border-white/10 pt-5 space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white/40">Event Progress</p>
              <p className="text-[11px] text-white/35">Pick a puzzle to see its history</p>
            </div>

            {/* Event pill filter */}
            <div className="flex flex-wrap gap-2">
              {events.map((e) => {
                const active = selectedEventId === e.id;
                return (
                  <button
                    key={e.id}
                    onClick={() => handleEventChange(e.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors [touch-action:manipulation] ${
                      active
                        ? "border-transparent bg-[#FFD500] text-[#1A1208]"
                        : "border-white/20 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    <EventIcon event={e.id} className="text-base" />
                    {EVENT_SHORT[e.id] || e.id}
                  </button>
                );
              })}
            </div>
          </div>

          {/* PB Staircase */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40">PB Progression</p>
            <div className="surface p-4">
              <PbStaircase data={analyticsData.pbStaircase} />
            </div>
          </div>

          {/* Competition Improvements */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40">Competition Improvements</p>
            <CompetitionImprovements data={analyticsData.competitionImprovements} />
          </div>
        </div>
      )}
    </div>
  );
}
