"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Flame } from "lucide-react";
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

interface KidPracticeTabProps {
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

export function KidPracticeTab({
  events,
  defaultEventId,
  cuberId,
  todayCount,
  todayBestCs,
  streak,
}: KidPracticeTabProps) {
  const [selectedId, setSelectedId] = useState(defaultEventId);
  const [, startTransition] = useTransition();
  const { scramble, next: nextScramble } = useScramble(selectedId);

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
    const cs = Math.floor((performance.now() - timerRef.current.startMs) / 10);

    // Minimum 80ms to prevent accidental stops
    if (cs < 80) return;

    clearRAF();
    timerRef.current.finalCs = cs;
    setDisplayCs(cs);
    setPenalty(timerRef.current.inspPenalty);
    timerRef.current.inspPenalty = "none";
    goPhase("stopped");
    if ("vibrate" in navigator) navigator.vibrate(30);
  }, []);

  const startInspection = useCallback(() => {
    clearInsp(); // Clear any existing interval
    timerRef.current.inspElapsed = 0;
    timerRef.current.inspPenalty = "none";
    setInspSec(15);
    goPhase("inspecting");

    timerRef.current.inspTimer = setInterval(() => {
      timerRef.current.inspElapsed += 1;
      const remaining = 15 - timerRef.current.inspElapsed;

      // Update display ONLY if not in holding state (hide countdown during hold)
      if (timerRef.current.phase !== "holding" && timerRef.current.phase !== "ready") {
        setInspSec(remaining);
      }

      // Warning at 8s elapsed (7s remaining)
      if (timerRef.current.inspElapsed === 8) {
        if ("vibrate" in navigator) navigator.vibrate(100);
      }
      // Warning at 12s elapsed (3s remaining)
      if (timerRef.current.inspElapsed === 12) {
        if ("vibrate" in navigator) navigator.vibrate(100);
      }
      // +2 penalty at 15s
      if (timerRef.current.inspElapsed === 15) {
        timerRef.current.inspPenalty = "plus2";
        if ("vibrate" in navigator) navigator.vibrate(50);
        setInspSec(0); // Show "+2" state
      }
      // DNF at 17s
      if (timerRef.current.inspElapsed >= 17) {
        clearInsp();
        timerRef.current.finalCs = 0;
        setPenalty("dnf");
        goPhase("stopped");
      }
    }, 1000);
  }, []);

  const onPressStart = useCallback(() => {
    const p = timerRef.current.phase;
    // Stop timer if running
    if (p === "running") { stopTimer(); return; }
    // Ignore if already in a hold/ready state
    if (p === "holding" || p === "ready" || p === "stopped") return;

    // If idle, start inspection first, then go to holding
    if (p === "idle") {
      startInspection();
    }

    // Start holding (works in both idle-turning-to-inspecting and inspecting states)
    goPhase("holding");
    setDisplayCs(0); // Show 0.00 during hold, hiding the countdown temporarily

    // After 500ms, transition to ready
    timerRef.current.holdTimer = setTimeout(() => {
      // Guard: only transition to ready if still holding
      if (timerRef.current.phase === "holding") {
        goPhase("ready");
      }
    }, 500);
  }, [stopTimer, startInspection]);

  const onPressEnd = useCallback(() => {
    const p = timerRef.current.phase;

    if (p === "ready") {
      clearHold();
      // Check if still in valid inspection window (< 17s)
      if (timerRef.current.inspElapsed < 17) {
        // Start the actual solve timer, carrying any +2 penalty
        startRunning();
      }
      // If inspection has already crossed DNF (>= 17s), it auto-recorded; do nothing
      return;
    }

    if (p === "holding") {
      clearHold();
      // Release during hold - if was inspecting, go back to inspecting state
      if (timerRef.current.inspTimer) {
        goPhase("inspecting");
        // Restore countdown display
        const remaining = 15 - timerRef.current.inspElapsed;
        setInspSec(remaining > 0 ? remaining : 0);
      } else {
        // Not inspecting - go back to idle
        goPhase("idle");
      }
    }
  }, [startRunning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { clearHold(); clearRAF(); clearInsp(); };
  }, []);

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
    <div className="relative flex flex-col text-white">
      {/* Event stickers */}
      <div className="relative z-10 mt-5 px-5 pb-3">
        <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
          Pick your puzzle
        </p>
        <div className="flex gap-2.5 overflow-x-auto overflow-y-visible scrollbar-none">
          {events.map((ev) => {
            const s = getEventSticker(ev.id);
            const active = ev.id === selectedId;
            return (
              <button
                key={ev.id}
                onClick={() => handleSelectEvent(ev.id)}
                className={`event-sticker relative shrink-0 rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition-all ${
                  active ? "sticker" : "hover:bg-white/10"
                }`}
                style={{
                  backgroundColor: active ? s.face : "rgba(255,255,255,0.06)",
                  color: active ? s.ink : "rgba(255,255,255,0.85)",
                  borderColor: active ? "#0A0A0A" : "rgba(255,255,255,0.15)",
                  boxShadow: active ? "4px 4px 0 #0A0A0A, inset 0 0 20px rgba(0,0,0,0.1)" : "1px 1px 0 rgba(255,255,255,0.1)",
                  transitionDuration: "150ms",
                }}
              >
                {EVENT_SHORT[ev.id] ?? ev.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hero — timer section */}
      <div className="relative z-10 flex flex-1 flex-col justify-center px-5 py-6">
        <div className="kid-animate-in mx-auto w-full max-w-sm" style={{ animationDelay: "80ms" }}>
          {/* Scramble display */}
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
              {timerPhase === "inspecting"
                ? inspSec > 0 ? String(inspSec) : "+2"
                : timerPhase === "stopped"
                ? penalty === "dnf" ? "DNF" : penalty === "plus2" ? formatCs(displayCs + 200) + "+" : formatCs(displayCs)
                : timerPhase === "running"
                ? formatCs(displayCs)
                : "0.00"}
            </p>
            <p className="mt-3 text-sm text-white/45">
              {timerPhase === "inspecting"
                ? inspSec <= 3 ? "Start now!" : "Inspecting…"
                : timerPhase === "running"
                ? "Solving…"
                : timerPhase === "stopped"
                ? ""
                : "Tap to start"}
            </p>
          </button>

          {/* Penalty bar + session stats */}
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

              {/* Session stats panel */}
              {stats && (
                <div className="mt-4 rounded-xl bg-white/8 px-4 py-3 kid-animate-in">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="font-mono-time text-base font-bold text-white">
                        {stats.ao5 ? formatCs(stats.ao5) : "—"}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-white/40">ao5</p>
                    </div>
                    <div>
                      <p className="font-mono-time text-base font-bold text-white">
                        {stats.ao12 ? formatCs(stats.ao12) : "—"}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-white/40">ao12</p>
                    </div>
                    <div>
                      <p className="font-display text-base font-bold text-white">{stats.count}</p>
                      <p className="text-[10px] uppercase tracking-wider text-white/40">count</p>
                    </div>
                  </div>
                  {stats.isPb && (
                    <p className="mt-2 text-center text-xs font-bold text-[#FFD500] animate-bounce">
                      🎉 NEW PB!
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats dock */}
      <div className="relative z-10 px-5 pt-4 kid-animate-in" style={{ animationDelay: "200ms" }}>
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
