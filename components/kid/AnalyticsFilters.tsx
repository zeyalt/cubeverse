"use client";

import { useEffect, useRef, useState } from "react";
import { EVENT_SHORT } from "@/lib/event-theme";
import { ChevronDown } from "lucide-react";
import { EventIcon } from "./EventIcon";

interface Event {
  id: string;
  name: string;
  format: string;
}

export type DateRange = "14d" | "30d" | "60d" | "month" | "all";

interface AnalyticsFiltersProps {
  events: Event[];
  selectedEventId: string;
  onEventChange: (eventId: string) => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  "14d": "14 days",
  "30d": "30 days",
  "60d": "60 days",
  "month": "This Month",
  "all": "All Dates",
};

export function AnalyticsFilters({
  events,
  selectedEventId,
  onEventChange,
  dateRange,
  onDateRangeChange,
}: AnalyticsFiltersProps) {
  const [eventOpen, setEventOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const closeAll = () => {
    setEventOpen(false);
    setDateOpen(false);
  };

  // Close any open dropdown when tapping/clicking outside the filter group,
  // so a stray menu never sits over the charts on mobile.
  useEffect(() => {
    if (!eventOpen && !dateOpen) return;
    const handle = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        closeAll();
      }
    };
    document.addEventListener("pointerdown", handle);
    return () => document.removeEventListener("pointerdown", handle);
  }, [eventOpen, dateOpen]);

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const selectedEventLabel = selectedEvent ? (EVENT_SHORT[selectedEventId] || selectedEventId) : "Event";

  return (
    <div ref={rootRef} className="flex gap-2">
      {/* Event dropdown */}
        <div className="relative flex-1">
          <button
            onClick={() => { const next = !eventOpen; closeAll(); setEventOpen(next); }}
            aria-haspopup="listbox"
            aria-expanded={eventOpen}
            aria-label="Filter by event"
            className="sticker w-full flex min-h-11 cursor-pointer items-center justify-between rounded-lg border-2 border-white/10 bg-white/8 px-3 py-2 font-bold text-sm text-white transition-all hover:bg-white/12 [touch-action:manipulation]"
          >
            <span className="flex flex-1 min-w-0 items-center gap-1.5">
              <EventIcon event={selectedEventId} className="shrink-0 text-base" />
              <span className="truncate text-left">{selectedEventLabel}</span>
            </span>
            <ChevronDown className={`size-4 flex-shrink-0 transition-transform ${eventOpen ? "rotate-180" : ""}`} />
          </button>

          {eventOpen && (
            <div role="listbox" className="absolute top-full left-0 mt-1 z-50 min-w-full w-36 rounded-lg border border-white/10 bg-[#1C1916] shadow-lg max-h-48 overflow-y-auto">
              {events.map((e) => (
                <button
                  key={e.id}
                  role="option"
                  aria-selected={selectedEventId === e.id}
                  onClick={() => {
                    onEventChange(e.id);
                    setEventOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 text-left px-3 py-2.5 font-bold text-sm transition-colors [touch-action:manipulation] ${
                    selectedEventId === e.id
                      ? "bg-[#FFD500]/20 text-[#FFD500]"
                      : "text-white hover:bg-white/10"
                  }`}
                >
                  <EventIcon event={e.id} className="shrink-0 text-base" />
                  {EVENT_SHORT[e.id] || e.id}
                </button>
              ))}
            </div>
          )}
        </div>

      {/* Date range dropdown */}
        <div className="relative flex-1">
          <button
            onClick={() => { const next = !dateOpen; closeAll(); setDateOpen(next); }}
            aria-haspopup="listbox"
            aria-expanded={dateOpen}
            aria-label="Filter by date range"
            className="sticker w-full flex min-h-11 cursor-pointer items-center justify-between rounded-lg border-2 border-white/10 bg-white/8 px-3 py-2 font-bold text-sm text-white transition-all hover:bg-white/12 [touch-action:manipulation]"
          >
            <span className="truncate text-left flex-1">{DATE_RANGE_LABELS[dateRange]}</span>
            <ChevronDown className={`size-4 flex-shrink-0 transition-transform ${dateOpen ? "rotate-180" : ""}`} />
          </button>

          {dateOpen && (
            <div role="listbox" className="absolute top-full right-0 mt-1 z-50 rounded-lg border border-white/10 bg-[#1C1916] shadow-lg w-40">
              {(Object.entries(DATE_RANGE_LABELS) as Array<[DateRange, string]>).map(([key, label]) => (
                <button
                  key={key}
                  role="option"
                  aria-selected={dateRange === key}
                  onClick={() => {
                    onDateRangeChange(key);
                    setDateOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 font-bold text-sm transition-colors [touch-action:manipulation] ${
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
  );
}
