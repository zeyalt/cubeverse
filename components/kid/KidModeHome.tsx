"use client";

import { useState, useTransition } from "react";
import { Settings, Flame, Zap, Play } from "lucide-react";
import Link from "next/link";
import { setSelectedEvent } from "@/app/actions/parent";
import { formatCs, DNF } from "@/lib/cubing";
import { EVENT_SHORT, getEventSticker } from "@/lib/event-theme";

interface Event {
  id: string;
  name: string;
  format: string;
}

interface Trophy {
  key: string;
  label: string;
  emoji: string;
}

interface KidModeHomeProps {
  cuberName: string;
  events: Event[];
  defaultEventId: string;
  todayCount: number;
  todayBestCs: number | null;
  streak: number;
  trophies: Trophy[];
}

export function KidModeHome({
  cuberName,
  events,
  defaultEventId,
  todayCount,
  todayBestCs,
  streak,
  trophies,
}: KidModeHomeProps) {
  const [selectedId, setSelectedId] = useState(defaultEventId);
  const [, startTransition] = useTransition();

  const selected = events.find((e) => e.id === selectedId) ?? events[0];
  const sticker = getEventSticker(selectedId);

  function handleSelectEvent(id: string) {
    setSelectedId(id);
    startTransition(() => setSelectedEvent(id));
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
          {events.map((ev, i) => {
            const s = getEventSticker(ev.id);
            const active = ev.id === selectedId;
            return (
              <button
                key={ev.id}
                onClick={() => handleSelectEvent(ev.id)}
                className={`shrink-0 rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition-all kid-animate-in ${
                  active ? "sticker -translate-y-0.5" : "hover:bg-white/10"
                }`}
                style={{
                  animationDelay: `${i * 40}ms`,
                  backgroundColor: active ? s.face : "rgba(255,255,255,0.06)",
                  color: active ? s.ink : "rgba(255,255,255,0.85)",
                  borderColor: active ? "#0A0A0A" : "rgba(255,255,255,0.15)",
                  boxShadow: active ? "4px 4px 0 #0A0A0A" : "none",
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

          <p className="font-mono-time text-[5.5rem] font-semibold leading-none tracking-tighter sm:text-[6.5rem]">
            0<span className="text-white/25">.</span>00
          </p>
          <p className="mt-3 text-sm text-white/45">Hold · release · solve!</p>
        </div>

        <div className="kid-animate-in mt-10 flex justify-center" style={{ animationDelay: "160ms" }}>
          <Link
            href="/timer"
            className="kid-go-wiggle sticker relative flex size-40 flex-col items-center justify-center gap-1 rounded-[2rem] sm:size-44"
            style={{
              backgroundColor: sticker.face,
              color: sticker.ink,
            }}
            aria-label="Start timer"
          >
            <Play className="size-14 fill-current sm:size-16" />
            <span className="font-display text-xl font-extrabold tracking-tight">GO!</span>
          </Link>
        </div>
      </div>

      {/* Trophies — sticker strip */}
      {trophies.length > 0 && (
        <div className="relative z-10 px-5 pb-2 kid-animate-in" style={{ animationDelay: "200ms" }}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
            Trophy shelf
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {trophies.map((t) => (
              <div
                key={t.key}
                className="sticker flex min-w-[4.75rem] shrink-0 flex-col items-center gap-1 rounded-xl bg-[#FFFCF7] px-2.5 py-2 text-[#1A1208]"
                title={t.label}
              >
                <span className="text-xl leading-none">{t.emoji}</span>
                <span className="line-clamp-2 text-center text-[9px] font-bold leading-tight">
                  {t.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats dock */}
      <div className="relative z-10 px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] kid-animate-in" style={{ animationDelay: "240ms" }}>
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
    <div className="sticker rounded-xl bg-[#FFFCF7] px-2 py-3 text-center text-[#1A1208]">
      <div
        className="mx-auto mb-1.5 h-1 w-8 rounded-full"
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
