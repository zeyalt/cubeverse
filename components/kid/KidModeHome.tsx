"use client";

import { useState, useTransition } from "react";
import { Settings, Flame, Timer, Play } from "lucide-react";
import Link from "next/link";
import { setSelectedEvent } from "@/app/actions/parent";
import { formatCs, DNF } from "@/lib/cubing";

interface Event {
  id: string;
  name: string;
  format: string;
}

interface KidModeHomeProps {
  cuberName: string;
  events: Event[];
  defaultEventId: string;
  todayCount: number;
  todayBestCs: number | null; // null = no solves, -1 = all DNF
}

const EVENT_COLORS: Record<string, string> = {
  "333": "from-blue-500 to-indigo-600",
  "222": "from-yellow-400 to-orange-500",
  pyram: "from-green-500 to-teal-600",
  skewb: "from-purple-500 to-violet-600",
  clock: "from-cyan-500 to-blue-500",
  "444": "from-orange-500 to-red-500",
  "333oh": "from-rose-500 to-pink-600",
};

const EVENT_SHORT: Record<string, string> = {
  "333": "3×3",
  "222": "2×2",
  pyram: "Pyraminx",
  skewb: "Skewb",
  clock: "Clock",
  "444": "4×4",
  "333oh": "3×3 OH",
};

export function KidModeHome({
  cuberName,
  events,
  defaultEventId,
  todayCount,
  todayBestCs,
}: KidModeHomeProps) {
  const [selectedId, setSelectedId] = useState(defaultEventId);
  const [, startTransition] = useTransition();

  const selected = events.find((e) => e.id === selectedId) ?? events[0];
  const gradient = EVENT_COLORS[selectedId] ?? "from-blue-500 to-indigo-600";

  function handleSelectEvent(id: string) {
    setSelectedId(id);
    startTransition(() => {
      setSelectedEvent(id);
    });
  }

  return (
    <div
      className={`min-h-screen flex flex-col bg-gradient-to-br ${gradient} text-white transition-all duration-500`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-8 pb-4">
        <div>
          <p className="text-white/70 text-sm font-medium">Hey,</p>
          <h1 className="text-3xl font-bold tracking-tight">{cuberName}!</h1>
        </div>
        <Link
          href="/parent"
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Parent mode"
        >
          <Settings className="w-5 h-5" />
        </Link>
      </div>

      {/* Event picker */}
      <div className="px-6 pb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {events.map((ev) => (
            <button
              key={ev.id}
              onClick={() => handleSelectEvent(ev.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                ev.id === selectedId
                  ? "bg-white text-zinc-900 shadow-lg scale-105"
                  : "bg-white/20 hover:bg-white/30 text-white"
              }`}
            >
              {EVENT_SHORT[ev.id] ?? ev.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main area — event display + START */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
        <div className="text-center">
          <p className="text-white/60 text-sm font-medium uppercase tracking-widest mb-1">
            {selected?.name ?? selectedId}
          </p>
          <p className="text-8xl font-black tracking-tighter">0:00</p>
          <p className="text-white/50 text-sm mt-2">Ready to solve</p>
        </div>

        {/* START button */}
        <Link
          href="/timer"
          className="w-48 h-48 rounded-full bg-white text-zinc-900 font-black text-3xl shadow-2xl
                     flex items-center justify-center gap-2
                     active:scale-95 transition-transform select-none hover:shadow-3xl"
          aria-label="Start timer"
        >
          <Play className="w-10 h-10 fill-zinc-900" />
        </Link>
      </div>

      {/* Stats bar */}
      <div className="px-6 pb-10">
        <div className="bg-white/10 rounded-2xl p-4 flex justify-around">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-orange-300">
              <Flame className="w-4 h-4" />
              <span className="font-bold text-lg">—</span>
            </div>
            <p className="text-white/60 text-xs mt-0.5">day streak</p>
          </div>
          <div className="w-px bg-white/20" />
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Timer className="w-4 h-4 text-white/70" />
              <span className="font-bold text-lg">
                {todayCount > 0 ? todayCount : "—"}
              </span>
            </div>
            <p className="text-white/60 text-xs mt-0.5">today</p>
          </div>
          <div className="w-px bg-white/20" />
          <div className="text-center">
            <span className="font-bold text-lg">
              {todayBestCs === null
                ? "—"
                : todayBestCs === DNF
                ? "DNF"
                : formatCs(todayBestCs)}
            </span>
            <p className="text-white/60 text-xs mt-0.5">best today</p>
          </div>
        </div>
      </div>
    </div>
  );
}
