"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Settings, Flame } from "lucide-react";
import Link from "next/link";
import { setSelectedEvent } from "@/app/actions/parent";
import { formatCs, DNF } from "@/lib/cubing";
import { EVENT_SHORT, getEventSticker } from "@/lib/event-theme";
import { useScramble } from "@/lib/useScramble";
import { recordSolve, type SessionStats } from "@/app/actions/solve";
import { enqueueSolve } from "@/lib/offline/queue";

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

type TimerPhase = "idle" | "holding" | "ready" | "inspecting" | "running" | "stopped";
type Penalty = "none" | "plus2" | "dnf";

interface TimerRefs {
  phase: TimerPhase;
  startMs: number;
  finalCs: number;
  holdTimer: ReturnType<typeof setTimeout> | null;
  raf: number | null;
  inspTimer: ReturnType<typeof setInterval> | null;
  inspElapsed: number;
  inspPenalty: Penalty;
}

function makeTimerRefs(): TimerRefs {
  return {
    phase: "idle",
    startMs: 0,
    finalCs: 0,
    holdTimer: null,
    raf: null,
    inspTimer: null,
    inspElapsed: 0,
    inspPenalty: "none",
  };
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
  const [, startTransition] = useTransition();
  const { scramble, next: nextScramble } = useScramble(selectedId);

  // Timer state
  const [timerPhase, setTimerPhase] = useState<TimerPhase>("idle");
  const [displayCs, setDisplayCs] = useState(0);
  const [penalty, setPenalty] = useState<Penalty>("none");
  const [inspSec, setInspSec] = useState(15);
  const [stats, setStats] = useState<SessionStats | null>(null);

  const timerRef = useRef<TimerRefs>(makeTimerRefs());

  const selected = events.find((e) => e.id === selectedId) ?? events[0];
  const sticker = getEventSticker(selectedId);

  function handleSelectEvent(id: string) {
    setSelectedId(id);
    startTransition(() => setSelectedEvent(id));
  }

  // Timer helpers
  function goPhase(p: TimerPhase) {
    timerRef.current.phase = p;
    setTimerPhase(p);
  }

  function clearHold() {
    if (timerRef.current.holdTimer) {
      clearTimeout(timerRef.current.holdTimer);
      timerRef.current.holdTimer = null;
    }
  }

  function clearRAF() {
    if (timerRef.current.raf) {
      cancelAnimationFrame(timerRef.current.raf);
      timerRef.current.raf = null;
    }
  }

  function clearInsp() {
    if (timerRef.current.inspTimer) {
      clearInterval(timerRef.current.inspTimer);
      timerRef.current.inspTimer = null;
    }
  }

  const startRunning = useCallback(() => {
    clearInsp();
    const carriedPenalty = timerRef.current.inspPenalty;
    timerRef.current.inspPenalty = "none";

    timerRef.current.startMs = performance.now();
    goPhase("running");
    setDisplayCs(0);
    if ("vibrate" in navigator) navigator.vibrate(50);

    function tick() {
      setDisplayCs(Math.floor((performance.now() - timerRef.current.startMs) / 10));
      timerRef.current.raf = requestAnimationFrame(tick);
    }
    timerRef.current.raf = requestAnimationFrame(tick);

    if (carriedPenalty !== "none") {
      timerRef.current.inspPenalty = carriedPenalty;
    }
  }, []);

  const stopTimer = useCallback(() => {
    clearRAF();
    const cs = Math.floor((performance.now() - timerRef.current.startMs) / 10);
    timerRef.current.finalCs = cs;
    setDisplayCs(cs);
    setPenalty(timerRef.current.inspPenalty);
    timerRef.current.inspPenalty = "none";
    goPhase("stopped");
    if ("vibrate" in navigator) navigator.vibrate(30);
  }, []);

  const startInspection = useCallback(() => {
    timerRef.current.inspElapsed = 0;
    timerRef.current.inspPenalty = "none";
    setInspSec(15);
    goPhase("inspecting");

    timerRef.current.inspTimer = setInterval(() => {
      timerRef.current.inspElapsed += 1;
      const remaining = 15 - timerRef.current.inspElapsed;
      setInspSec(remaining);

      if (timerRef.current.inspElapsed === 15) {
        timerRef.current.inspPenalty = "plus2";
      }
      if (timerRef.current.inspElapsed >= 17) {
        clearInsp();
        timerRef.current.inspPenalty = "none";
        timerRef.current.finalCs = 0;
        setDisplayCs(0);
        setPenalty("dnf");
        goPhase("stopped");
      }
    }, 1000);
  }, []);

  const onPressStart = useCallback(() => {
    const p = timerRef.current.phase;
    if (p === "running") { stopTimer(); return; }
    if (p === "inspecting") { startRunning(); return; }
    if (p !== "idle") return;
    goPhase("holding");
    timerRef.current.holdTimer = setTimeout(() => goPhase("ready"), 400);
  }, [startRunning, stopTimer]);

  const onPressEnd = useCallback(() => {
    const p = timerRef.current.phase;
    if (p === "ready") {
      clearHold();
      startInspection();
      return;
    }
    if (p === "holding") {
      clearHold();
      goPhase("idle");
    }
  }, [startInspection]);

  // Cleanup on unmount
  useEffect(() => () => { clearHold(); clearRAF(); clearInsp(); }, []);

  // Keyboard support
  useEffect(() => {
    let down = false;
    const kd = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault();
      if (!down) { down = true; onPressStart(); }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      down = false;
      onPressEnd();
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, [onPressStart, onPressEnd]);

  function deleteSolve() {
    goPhase("idle");
    setDisplayCs(0);
    setPenalty("none");
    setInspSec(15);
    nextScramble();
  }

  function saveAndNext(chosenPenalty: Penalty) {
    const cs = timerRef.current.finalCs;
    goPhase("idle");
    setDisplayCs(0);
    setPenalty("none");
    setInspSec(15);
    nextScramble();

    const solveInput = {
      cuberId,
      eventId: selectedId,
      timeCs: cs,
      penalty: chosenPenalty,
      scramble: scramble,
    };

    if (!navigator.onLine) {
      enqueueSolve(solveInput).catch((err) =>
        console.error("Failed to queue solve:", err)
      );
      setStats((prev) => ({
        sessionId: prev?.sessionId ?? "offline",
        count: (prev?.count ?? 0) + 1,
        bestCs: prev?.bestCs ?? null,
        ao5: prev?.ao5 ?? null,
        ao12: prev?.ao12 ?? null,
        isPb: false,
        newBadges: [],
      }));
      return;
    }

    recordSolve(solveInput)
      .then((result) => {
        setStats(result);
      })
      .catch((err) => {
        console.error("Failed to save solve, queuing offline:", err);
        enqueueSolve(solveInput).catch(console.error);
      });
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
          {/* Scramble display (above timer) */}
          <div className="kid-animate-in px-5 py-4 rounded-lg bg-white/5 w-full mx-auto cursor-pointer transition-opacity hover:opacity-80 mb-8" onClick={() => onPressStart()} style={{ animationDelay: "80ms" }}>
            <p className="font-mono-time text-center text-base leading-loose tracking-wide text-white/80">
              {scramble ?? "Generating scramble…"}
            </p>
          </div>

          {/* Timer display */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              onPressStart();
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              onPressEnd();
            }}
            className="w-full cursor-pointer transition-opacity hover:opacity-80"
            style={{ touchAction: "none" }}
          >
            <p className="font-mono-time text-[5.5rem] font-semibold leading-none tracking-tighter sm:text-[6.5rem]">
              {timerPhase === "inspecting" ? inspSec > 0 ? String(inspSec) : "+2" :
               timerPhase === "stopped" ? (penalty === "dnf" ? "DNF" : penalty === "plus2" ? formatCs(displayCs + 200) + "+" : formatCs(displayCs)) :
               timerPhase === "running" ? formatCs(displayCs) : "0<span className=\"text-white/25\">.</span>00"}
            </p>
            <p className="mt-3 text-sm text-white/45">
              {timerPhase === "inspecting" ? inspSec <= 3 ? "Start now!" : "Inspecting…" :
               timerPhase === "running" ? "Solving…" :
               timerPhase === "stopped" ? "" :
               "Tap to start"}
            </p>
          </button>

          {/* Penalty bar */}
          {timerPhase === "stopped" && (
            <div className="mt-6 space-y-3 mx-auto w-full max-w-sm">
              <div className="grid grid-cols-3 gap-2">
                {([
                  { p: "none" as Penalty, label: "OK", face: "#009B48", ink: "#FFF" },
                  { p: "plus2" as Penalty, label: "+2", face: "#FFD500", ink: "#1A1200" },
                  { p: "dnf" as Penalty, label: "DNF", face: "#B71234", ink: "#FFF" },
                ] as const).map(({ p, label, face, ink }) => (
                  <button
                    key={p}
                    onClick={() => setPenalty(p)}
                    className={`sticker rounded-lg py-2 font-bold text-xs transition-all ${penalty === p ? "scale-105" : ""}`}
                    style={{
                      backgroundColor: face,
                      color: ink,
                      boxShadow: penalty === p ? "3px 3px 0 #0A0A0A" : "1px 1px 0 #0A0A0A",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => deleteSolve()}
                  className="flex-1 rounded-lg py-2 bg-white/10 text-white text-xs font-medium transition-colors hover:bg-white/20"
                >
                  Delete
                </button>
                <button
                  onClick={() => saveAndNext(penalty)}
                  className="flex-1 rounded-lg py-2 bg-white/20 text-white text-xs font-medium transition-colors hover:bg-white/30"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
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
