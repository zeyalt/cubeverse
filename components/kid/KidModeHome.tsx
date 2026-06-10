"use client";

import { useState, useTransition } from "react";
import { Settings, Flame, Zap } from "lucide-react";
import Link from "next/link";
import { setSelectedEvent } from "@/app/actions/parent";
import { formatCs, DNF } from "@/lib/cubing";
import { EVENT_SHORT, getEventSticker } from "@/lib/event-theme";
import { useScramble } from "@/lib/useScramble";
import { TimerView } from "@/components/timer/TimerView";

interface Event {
  id: string;
  name: string;
  format: string;
}

interface KidModeHomeProps {
  cuberName: string;
  events: Event[];
  defaultEventId: string;
  cuberId: string;
  todayCount: number;
  todayBestCs: number | null;
  streak: number;
}

export function KidModeHome({
  cuberName,
  events,
  defaultEventId,
  cuberId,
  todayCount,
  todayBestCs,
  streak,
}: KidModeHomeProps) {
  const [selectedId, setSelectedId] = useState(defaultEventId);
  const [showTimer, setShowTimer] = useState(false);
  const [, startTransition] = useTransition();
  const { scramble } = useScramble(selectedId);

  const selected = events.find((e) => e.id === selectedId) ?? events[0];
  const sticker = getEventSticker(selectedId);

  function handleSelectEvent(id: string) {
    setSelectedId(id);
    startTransition(() => setSelectedEvent(id));
  }

  if (showTimer) {
    return (
      <TimerView
        event={selected}
        cuberId={cuberId}
        cuberName={cuberName}
        onBack={() => setShowTimer(false)}
      />
    );
  }

  return (
    <div className="kid-canvas relative flex min-h-screen flex-col text-white">
      {/* Header */}
      <header className="relative z-10 flex items-start justify-between gap-4 px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="kid-animate-in">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
            Cubeverse
          </p>
          <h1 className="font-display mt-1 text-[2.5rem] font-extrabold leading-[0.95] tracking-tight sm:text-5xl">
            {cuberName}
          </h1>
        </div>
        <Link
          href="/parent"
          className="sticker-ghost mt-1 flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm transition-transform active:scale-95"
          aria-label="Parent mode"
        >
          <Settings className="size-5" />
        </Link>
      </header>

      {/* Event stickers */}
      <div className="relative z-10 mt-5 px-5">
        <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
          Pick your puzzle
        </p>
        <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
          {events.map((ev) => {
            const s = getEventSticker(ev.id);
            const active = ev.id === selectedId;
            return (
              <button
                key={ev.id}
                onClick={() => handleSelectEvent(ev.id)}
                className={`event-sticker shrink-0 rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition-all ${
                  active ? "sticker -translate-y-1 scale-105" : "hover:bg-white/10 hover:scale-110"
                }`}
                style={{
                  backgroundColor: active ? s.face : "rgba(255,255,255,0.06)",
                  color: active ? s.ink : "rgba(255,255,255,0.85)",
                  borderColor: active ? "#0A0A0A" : "rgba(255,255,255,0.15)",
                  boxShadow: active ? "6px 6px 0 #0A0A0A, inset 0 0 20px rgba(0,0,0,0.1)" : "none",
                  transitionDuration: "150ms",
                }}
              >
                {EVENT_SHORT[ev.id] ?? ev.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hero — asymmetric */}
      <div className="relative z-10 flex flex-1 flex-col justify-center px-5 py-6">
        <div className="kid-animate-in mx-auto w-full max-w-sm" style={{ animationDelay: "80ms" }}>
          <div
            className="mb-6 inline-flex items-center gap-2 rounded-full border-2 border-black px-3 py-1 text-xs font-bold uppercase tracking-widest"
            style={{ backgroundColor: sticker.face, color: sticker.ink, boxShadow: "3px 3px 0 #0A0A0A" }}
          >
            <Zap className="size-3.5" fill="currentColor" />
            {selected?.name ?? selectedId}
          </div>

          <button
            onClick={() => setShowTimer(true)}
            className="w-full transition-opacity hover:opacity-80"
          >
            <p className="font-mono-time text-[5.5rem] font-semibold leading-none tracking-tighter sm:text-[6.5rem]">
              0<span className="text-white/25">.</span>00
            </p>
            <p className="mt-3 text-sm text-white/45">Hold · release · solve!</p>
          </button>
        </div>

        {/* Scramble display */}
        <div className="kid-animate-in mt-8 px-5 py-4 rounded-lg bg-white/5 w-full max-w-sm mx-auto cursor-pointer transition-opacity hover:opacity-80" onClick={() => setShowTimer(true)} style={{ animationDelay: "120ms" }}>
          <p className="font-mono-time text-center text-base leading-loose tracking-wide text-white/80">
            {scramble ?? "Generating scramble…"}
          </p>
        </div>
      </div>

      {/* Stats dock */}
      <div className="relative z-10 px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] kid-animate-in" style={{ animationDelay: "200ms" }}>
        <div className="grid grid-cols-3 gap-2.5">
          <StatSticker
            icon={<Flame className="size-4" style={{ color: "#FF5800" }} />}
            value={streak > 0 ? String(streak) : "—"}
            label="streak"
            accent="#FF5800"
          />
          <StatSticker
            value={todayCount > 0 ? String(todayCount) : "—"}
            label="today"
            accent="#0046AD"
          />
          <StatSticker
            value={
              todayBestCs === null
                ? "—"
                : todayBestCs === DNF
                ? "DNF"
                : formatCs(todayBestCs)
            }
            label="best"
            accent="#009B48"
            mono
          />
        </div>
      </div>
    </div>
  );
}

function StatSticker({
  icon,
  value,
  label,
  accent,
  mono,
}: {
  icon?: React.ReactNode;
  value: string;
  label: string;
  accent: string;
  mono?: boolean;
}) {
  return (
    <div className="sticker group rounded-xl bg-[#FFFCF7] px-2 py-3 text-center text-[#1A1208] transition-transform active:scale-95 hover:shadow-lg" style={{ boxShadow: "3px 3px 0 #1A1208" }}>
      <div
        className="mx-auto mb-1.5 h-1.5 w-8 rounded-full transition-all group-hover:w-10"
        style={{ backgroundColor: accent }}
      />
      <div className="flex items-center justify-center gap-1">
        {icon}
        <span className={`text-lg font-bold ${mono ? "font-mono-time text-base" : "font-display"}`}>
          {value}
        </span>
      </div>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[#6B5E4C]">
        {label}
      </p>
    </div>
  );
}
