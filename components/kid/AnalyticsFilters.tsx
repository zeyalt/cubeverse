"use client";

import { useState } from "react";
import { EVENT_SHORT } from "@/lib/event-theme";
import { ChevronDown } from "lucide-react";

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

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  "14d": "14 days",
  "30d": "30 days",
  "60d": "60 days",
  "month": "This Month",
  "all": "All",
};

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
  const [eventOpen, setEventOpen] = useState(false);
  const [cubesOpen, setCubesOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  const toggleCube = (cubeId: string) => {
    const newSet = new Set(selectedCubeIds);
    if (newSet.has(cubeId)) {
      newSet.delete(cubeId);
    } else {
      newSet.add(cubeId);
    }
    onCubesChange(newSet);
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const selectedEventLabel = selectedEvent ? (EVENT_SHORT[selectedEventId] || selectedEventId) : "Event";
  const cubesLabel = selectedCubeIds.size === 0 ? "All Cubes" : `${selectedCubeIds.size} selected`;

  return (
    <div className="space-y-2">
      {/* Row 1: Event (left) | Date Range (right) */}
      <div className="grid grid-cols-2 gap-2">
        {/* Event dropdown */}
        <div className="relative">
          <button
            onClick={() => setEventOpen(!eventOpen)}
            className="sticker w-full flex items-center justify-between rounded-lg border-2 border-white/10 bg-white/8 px-3 py-2 font-bold text-sm text-white transition-all hover:bg-white/12"
          >
            <span className="truncate text-left flex-1">{selectedEventLabel}</span>
            <ChevronDown className={`size-4 flex-shrink-0 transition-transform ${eventOpen ? "rotate-180" : ""}`} />
          </button>

          {eventOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-white/10 bg-[#1C1916] shadow-lg max-h-48 overflow-y-auto">
              {events.map((e) => (
                <button
                  key={e.id}
                  onClick={() => {
                    onEventChange(e.id);
                    setEventOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 font-bold text-sm transition-colors ${
                    selectedEventId === e.id
                      ? "bg-[#FFD500]/20 text-[#FFD500]"
                      : "text-white hover:bg-white/10"
                  }`}
                >
                  {EVENT_SHORT[e.id] || e.id}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date range dropdown */}
        <div className="relative">
          <button
            onClick={() => setDateOpen(!dateOpen)}
            className="sticker w-full flex items-center justify-between rounded-lg border-2 border-white/10 bg-white/8 px-3 py-2 font-bold text-sm text-white transition-all hover:bg-white/12"
          >
            <span className="truncate text-left flex-1">{DATE_RANGE_LABELS[dateRange]}</span>
            <ChevronDown className={`size-4 flex-shrink-0 transition-transform ${dateOpen ? "rotate-180" : ""}`} />
          </button>

          {dateOpen && (
            <div className="absolute top-full right-0 mt-1 z-50 rounded-lg border border-white/10 bg-[#1C1916] shadow-lg w-40">
              {(Object.entries(DATE_RANGE_LABELS) as Array<[DateRange, string]>).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    onDateRangeChange(key);
                    setDateOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 font-bold text-sm transition-colors ${
                    dateRange === key
                      ? "bg-[#009B48]/20 text-[#009B48]"
                      : "text-white hover:bg-white/10"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Cubes (full width) */}
      {cubes.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setCubesOpen(!cubesOpen)}
            className="sticker w-full flex items-center justify-between rounded-lg border-2 border-white/10 bg-white/8 px-3 py-2 font-bold text-sm text-white transition-all hover:bg-white/12"
          >
            <span className="truncate text-left flex-1">{cubesLabel}</span>
            <ChevronDown className={`size-4 flex-shrink-0 transition-transform ${cubesOpen ? "rotate-180" : ""}`} />
          </button>

          {cubesOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-white/10 bg-[#1C1916] shadow-lg max-h-48 overflow-y-auto">
              {cubes.map((cube) => (
                <button
                  key={cube.id}
                  onClick={() => toggleCube(cube.id)}
                  className={`w-full text-left px-3 py-2 font-bold text-sm transition-colors flex items-center gap-2 ${
                    selectedCubeIds.has(cube.id)
                      ? "bg-[#0046AD]/20 text-[#0046AD]"
                      : "text-white hover:bg-white/10"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedCubeIds.has(cube.id)}
                    onChange={() => {}}
                    className="pointer-events-none"
                  />
                  {cube.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
