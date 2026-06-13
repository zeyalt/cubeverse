"use client";

import { EVENT_SHORT } from "@/lib/event-theme";

interface Event {
  id: string;
  name: string;
  format: string;
}

interface Cube {
  id: string;
  name: string;
}

export type DateRange = "14d" | "30d" | "60d" | "month" | "all";

interface AnalyticsFiltersProps {
  events: Event[];
  selectedEventId: string;
  onEventChange: (eventId: string) => void;
  cubes: Cube[];
  selectedCubeIds: Set<string>;
  onCubesChange: (cubeIds: Set<string>) => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

export function AnalyticsFilters({
  events,
  selectedEventId,
  onEventChange,
  cubes,
  selectedCubeIds,
  onCubesChange,
  dateRange,
  onDateRangeChange,
}: AnalyticsFiltersProps) {
  const toggleCube = (cubeId: string) => {
    const newSet = new Set(selectedCubeIds);
    if (newSet.has(cubeId)) {
      newSet.delete(cubeId);
    } else {
      newSet.add(cubeId);
    }
    onCubesChange(newSet);
  };

  return (
    <div className="space-y-4">
      {/* Event selector */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-white/40">Event</p>
        <div className="flex flex-wrap gap-2">
          {events.map((e) => (
            <button
              key={e.id}
              onClick={() => onEventChange(e.id)}
              className={`sticker px-4 py-2 rounded-lg font-bold text-sm transition-all ${
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

      {/* Cube selector */}
      {cubes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-white/40">Cubes</p>
          <div className="flex flex-wrap gap-2">
            {cubes.map((cube) => (
              <button
                key={cube.id}
                onClick={() => toggleCube(cube.id)}
                className={`sticker px-3 py-2 rounded-lg font-bold text-sm transition-all ${
                  selectedCubeIds.has(cube.id)
                    ? "bg-[#0046AD] text-white shadow-lg"
                    : "bg-white/10 text-white hover:bg-white/15"
                }`}
                style={
                  selectedCubeIds.has(cube.id)
                    ? { boxShadow: "4px 4px 0 rgba(0,0,0,0.3)" }
                    : undefined
                }
              >
                {cube.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Date range selector */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-white/40">Date Range</p>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "14d", label: "14 days" },
            { key: "30d", label: "30 days" },
            { key: "60d", label: "60 days" },
            { key: "month", label: "This Month" },
            { key: "all", label: "All" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => onDateRangeChange(opt.key as DateRange)}
              className={`sticker px-3 py-2 rounded-lg font-bold text-sm transition-all ${
                dateRange === opt.key
                  ? "bg-[#009B48] text-white shadow-lg"
                  : "bg-white/10 text-white hover:bg-white/15"
              }`}
              style={
                dateRange === opt.key
                  ? { boxShadow: "4px 4px 0 rgba(0,0,0,0.3)" }
                  : undefined
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
