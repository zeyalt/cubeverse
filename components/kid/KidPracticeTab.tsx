"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ChevronRight, X } from "lucide-react";
import { formatCs, parseToCs, DNF } from "@/lib/cubing";
import { EVENT_SHORT, getEventSticker } from "@/lib/event-theme";
import { useScramble } from "@/lib/useScramble";
import { recordSolve, type SessionStats } from "@/app/actions/solve";
import { enqueueSolve } from "@/lib/offline/queue";
import { getPracticeSetupData, setPracticeGoal, clearPracticeGoal } from "@/app/actions/goals";

interface Event {
  id: string;
  name: string;
  format: string;
}

interface Cube {
  id: string;
  name: string;
  event_id: string | null;
}

interface KidPracticeTabProps {
  events: Event[];
  defaultEventId: string;
  cuberId: string;
  cubes: Cube[];
  activeGoal: { id: string; target_cs: number } | null;
  ao5: number | null;
  ao12: number | null;
  ao50: number | null;
  ao100: number | null;
  best: number | null;
  count: number;
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
  cubes: initialCubes,
  activeGoal: initialGoal,
  ao5,
  ao12,
  ao50,
  ao100,
  best,
  count,
}: KidPracticeTabProps) {
  const [selectedId, setSelectedId] = useState(defaultEventId);
  const [, startTransition] = useTransition();
  const { scramble, next: nextScramble } = useScramble(selectedId);

  const [timerPhase, setTimerPhase] = useState<TimerPhase>("idle");
  const [displayCs, setDisplayCs] = useState(0);
  const [penalty, setPenalty] = useState<Penalty>("none");
  const [inspSec, setInspSec] = useState(15);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [showHoldMsg, setShowHoldMsg] = useState(false);
  const holdMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cube + Goal state
  const [cubes, setCubes] = useState<Cube[]>(initialCubes);
  const [selectedCubeId, setSelectedCubeId] = useState<string | null>(null);
  const [activeGoal, setActiveGoal] = useState(initialGoal);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [setupSheetOpen, setSetupSheetOpen] = useState(false);

  const timerRef = useRef<TimerRefs>(makeTimerRefs());

  const selected = events.find((e) => e.id === selectedId) ?? events[0];
  const sticker = getEventSticker(selectedId);

  function handleSelectEvent(id: string) {
    setSelectedId(id);
    setSelectedCubeId(null);
    setEditingGoal(false);
    startTransition(async () => {
      const setup = await getPracticeSetupData(cuberId, id);
      setCubes(setup.cubes);
      setActiveGoal(setup.activeGoal);
    });
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

      // Always update display - countdown continues even during hold/ready
      setInspSec(remaining);

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

    // Start holding (works in both idle and inspecting states)
    goPhase("holding");
    setShowHoldMsg(false);
    holdMsgTimer.current = setTimeout(() => setShowHoldMsg(true), 1500);
    // Don't show 0.00 - keep showing the countdown during hold
    // setDisplayCs(0); is removed

    // After 500ms, transition to ready
    timerRef.current.holdTimer = setTimeout(() => {
      // Guard: only transition to ready if still holding
      if (timerRef.current.phase === "holding") {
        goPhase("ready");
      }
    }, 500);
  }, [stopTimer]);

  const onPressEnd = useCallback(() => {
    if (holdMsgTimer.current) { clearTimeout(holdMsgTimer.current); holdMsgTimer.current = null; }
    setShowHoldMsg(false);
    const p = timerRef.current.phase;

    if (p === "ready") {
      clearHold();
      // If inspection is running, start the actual solve timer
      if (timerRef.current.inspTimer && timerRef.current.inspElapsed < 17) {
        startRunning();
      } else if (!timerRef.current.inspTimer) {
        // If not inspecting yet (ready from idle), start inspection on release
        startInspection();
      }
      // If inspection has already crossed DNF (>= 17s), it auto-recorded; do nothing
      return;
    }

    if (p === "holding") {
      clearHold();
      // Release during hold
      if (timerRef.current.inspTimer) {
        // If already inspecting, go back to inspecting state
        goPhase("inspecting");
        // Restore countdown display
        const remaining = 15 - timerRef.current.inspElapsed;
        setInspSec(remaining > 0 ? remaining : 0);
      } else {
        // If not yet inspecting (in idle state), start inspection on release
        startInspection();
      }
    }
  }, [startRunning, startInspection]);

  // Reset inspection when user presses Escape or back button
  const resetInspection = useCallback(() => {
    clearHold();
    clearRAF();
    clearInsp();
    if (holdMsgTimer.current) { clearTimeout(holdMsgTimer.current); holdMsgTimer.current = null; }
    setShowHoldMsg(false);
    goPhase("idle");
    setDisplayCs(0);
    setPenalty("none");
    setInspSec(15);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { clearHold(); clearRAF(); clearInsp(); };
  }, []);

  // Android back button / browser back during inspection or running
  useEffect(() => {
    const isActive = timerPhase === "inspecting" || timerPhase === "holding" || timerPhase === "ready" || timerPhase === "running";
    if (isActive) {
      // Push a dummy state so the back button hits popstate instead of navigating
      window.history.pushState({ inspection: true }, "");
      const handlePop = () => resetInspection();
      window.addEventListener("popstate", handlePop);
      return () => window.removeEventListener("popstate", handlePop);
    }
  }, [timerPhase, resetInspection]);

  useEffect(() => {
    let down = false;
    const kd = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!down) { down = true; onPressStart(); }
      } else if (e.code === "Escape") {
        e.preventDefault();
        resetInspection();
      }
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
  }, [onPressStart, onPressEnd, resetInspection]);

  function deleteSolve() {
    goPhase("idle");
    setDisplayCs(0);
    setPenalty("none");
    setInspSec(15);
    nextScramble();
  }

  function saveAndNext(chosenPenalty: Penalty) {
    const cs = timerRef.current.finalCs;
    const currentScramble = scramble || "";

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
      scramble: currentScramble,
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

      {/* ── Compact setup bar ─────────────────────────────────────────────── */}
      <div className="relative z-10 px-4 pt-4 pb-2 space-y-2">

        {/* Row 1: puzzle pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {events.map((ev) => {
            const s = getEventSticker(ev.id);
            const active = ev.id === selectedId;
            return (
              <button
                key={ev.id}
                onClick={() => handleSelectEvent(ev.id)}
                className="shrink-0 rounded-lg border-2 px-3 py-1.5 text-xs font-bold transition-all"
                style={{
                  backgroundColor: active ? s.face : "rgba(255,255,255,0.06)",
                  color: active ? s.ink : "rgba(255,255,255,0.7)",
                  borderColor: active ? "#0A0A0A" : "rgba(255,255,255,0.12)",
                  boxShadow: active ? "3px 3px 0 #0A0A0A" : "none",
                  transitionDuration: "120ms",
                }}
              >
                {EVENT_SHORT[ev.id] ?? ev.name}
              </button>
            );
          })}
        </div>

        {/* Row 2: single setup row → opens bottom sheet */}
        <button
          onClick={() => setSetupSheetOpen(true)}
          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 transition-colors hover:bg-white/8 active:bg-white/10"
        >
          <div className="flex items-center gap-2 text-xs text-white/50 min-w-0">
            {/* Cube */}
            <span className="truncate">
              {selectedCubeId
                ? (cubes.find((c) => c.id === selectedCubeId)?.name ?? "Unknown")
                : cubes.length > 0 ? "Any cube" : "No cubes set up"}
            </span>
            {/* Goal */}
            {activeGoal && (
              <>
                <span className="text-white/20">·</span>
                <span className="text-[#FFD500] font-mono-time font-bold">
                  🎯 {(activeGoal.target_cs / 100).toFixed(2)}
                </span>
              </>
            )}
            {!activeGoal && (
              <>
                <span className="text-white/20">·</span>
                <span className="text-white/30">No target</span>
              </>
            )}
          </div>
          <ChevronRight className="size-4 text-white/20 shrink-0" />
        </button>
      </div>

      {/* ── Session Setup Sheet ──────────────────────────────────────────── */}
      {setupSheetOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setSetupSheetOpen(false)} />
          <div className="sheet-enter fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t-2 border-white/10 bg-[#1C1916] px-5 pt-4"
            style={{ paddingBottom: "calc(5rem + 1.5rem + env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-lg font-bold text-white">Session Setup</h3>
              <button onClick={() => setSetupSheetOpen(false)} className="flex size-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20">
                <X className="size-4" />
              </button>
            </div>

            {/* Cube picker */}
            <div className="space-y-2 mb-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Cube</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCubeId(null)}
                  className="rounded-lg border-2 px-3 py-1.5 text-sm font-bold transition-all"
                  style={selectedCubeId === null ? {
                    backgroundColor: "#0046AD", color: "#fff",
                    borderColor: "#0A0A0A", boxShadow: "3px 3px 0 #0A0A0A",
                  } : {
                    backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)",
                    borderColor: "rgba(255,255,255,0.12)",
                  }}
                >
                  Any cube
                </button>
                {cubes.map((cube) => (
                  <button
                    key={cube.id}
                    onClick={() => setSelectedCubeId(cube.id)}
                    className="rounded-lg border-2 px-3 py-1.5 text-sm font-bold transition-all"
                    style={selectedCubeId === cube.id ? {
                      backgroundColor: "#0046AD", color: "#fff",
                      borderColor: "#0A0A0A", boxShadow: "3px 3px 0 #0A0A0A",
                    } : {
                      backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)",
                      borderColor: "rgba(255,255,255,0.12)",
                    }}
                  >
                    {cube.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Goal picker */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Target Time</p>
              {activeGoal && !editingGoal ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1 rounded-xl border-2 border-[#FFD500]/30 bg-[#FFD500]/10 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFD500]/60">Goal</p>
                    <p className="font-mono-time text-2xl font-bold text-[#FFD500]">
                      {(activeGoal.target_cs / 100).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => { setGoalInput((activeGoal.target_cs / 100).toFixed(2)); setEditingGoal(true); }}
                      className="rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-xs font-bold text-white/60 hover:bg-white/12"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => { await clearPracticeGoal(cuberId, selectedId); setActiveGoal(null); }}
                      className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : editingGoal ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    placeholder="e.g. 15.00"
                    autoFocus
                    className="flex-1 rounded-xl border-2 border-white/20 bg-white/10 px-4 py-3 font-mono-time text-white placeholder-white/30 focus:outline-none focus:border-[#FFD500]/50"
                  />
                  <button
                    onClick={async () => {
                      const cs = parseToCs(goalInput);
                      if (cs > 0) {
                        const result = await setPracticeGoal(cuberId, selectedId, cs);
                        if (!result.error) {
                          setActiveGoal({ id: "optimistic", target_cs: cs });
                          setEditingGoal(false);
                          setGoalInput("");
                          const setup = await getPracticeSetupData(cuberId, selectedId);
                          setActiveGoal(setup.activeGoal);
                        }
                      }
                    }}
                    className="rounded-xl border-2 border-[#0A0A0A] bg-[#009B48] px-4 font-bold text-white"
                    style={{ boxShadow: "3px 3px 0 #0A0A0A" }}
                  >
                    Set
                  </button>
                  <button
                    onClick={() => { setEditingGoal(false); setGoalInput(""); }}
                    className="rounded-xl border border-white/10 bg-white/8 px-3 font-bold text-white/50"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingGoal(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/15 py-3 text-sm font-bold text-white/40 transition-colors hover:border-white/25 hover:text-white/60"
                >
                  + Set target time
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Scramble — floats at top of hero, size varies */}
      <div className="relative z-10 px-5 pt-3">
        <div
          className="kid-animate-in rounded-lg bg-white/5 w-full max-w-sm mx-auto cursor-pointer transition-opacity hover:opacity-80 px-4 py-3"
          style={{ animationDelay: "80ms" }}
          onClick={() => onPressStart()}
        >
          <p className="font-mono-time text-center text-sm leading-relaxed tracking-wide text-white/80">
            {scramble ?? "Generating scramble…"}
          </p>
        </div>
      </div>

      {/* Timer — FIXED to viewport, never moves regardless of scramble height */}
      <div
        className="kid-animate-in fixed left-0 right-0 z-20 flex items-center justify-center px-5"
        style={{ top: "50%", transform: "translateY(-50%)", animationDelay: "80ms", pointerEvents: "none" }}
      >
        <div className="w-full max-w-sm mx-auto" style={{ pointerEvents: "auto" }}>

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
            className="w-full cursor-pointer transition-opacity hover:opacity-80 select-none"
            style={{ touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}
          >
            <p className="font-mono-time text-[5.5rem] font-semibold leading-none tracking-tighter sm:text-[6.5rem] select-none" style={{ userSelect: "none", WebkitUserSelect: "none" }}>
              {timerPhase === "inspecting" || timerPhase === "holding" || timerPhase === "ready"
                ? inspSec > 0 ? String(inspSec) : "+2"
                : timerPhase === "stopped"
                ? penalty === "dnf" ? "DNF" : penalty === "plus2" ? formatCs(displayCs + 200) + "+" : formatCs(displayCs)
                : timerPhase === "running"
                ? formatCs(displayCs)
                : "0.00"}
            </p>
            <p className="mt-3 text-sm text-white/45 select-none" style={{ userSelect: "none", WebkitUserSelect: "none" }}>
              {timerPhase === "inspecting"
                ? inspSec <= 3 ? "Start now!" : "Inspecting…"
                : timerPhase === "holding"
                ? timerRef.current.inspTimer ? "" : (showHoldMsg ? "Release to start inspection" : "")
                : timerPhase === "ready"
                ? timerRef.current.inspTimer ? "Release to start" : "Release to start inspection"
                : timerPhase === "running"
                ? ""
                : timerPhase === "stopped"
                ? ""
                : "Tap to start inspection"}
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

      {/* Stats strip - fixed above bottom nav */}
      <div
        className="fixed left-0 right-0 z-30 border-t border-white/8 kid-animate-in"
        style={{
          bottom: "calc(4.5rem + env(safe-area-inset-bottom))",
          background: "rgba(10,10,10,0.88)",
          backdropFilter: "blur(12px)",
          animationDelay: "200ms",
        }}
      >
        <div className="grid grid-cols-6 divide-x divide-white/8">
          {([
            { label: "ao5",   value: ao5 },
            { label: "ao12",  value: ao12 },
            { label: "ao50",  value: ao50 },
            { label: "ao100", value: ao100 },
            { label: "best",  value: best },
          ] as const).map(({ label, value }) => (
            <div key={label} className="flex flex-col items-center py-2 px-1">
              <p className="font-mono-time text-[11px] font-bold text-white leading-none">
                {value ? (value / 100).toFixed(2) : "—"}
              </p>
              <p className="text-[8px] font-bold uppercase tracking-wider text-white/30 mt-0.5">{label}</p>
            </div>
          ))}
          <div className="flex flex-col items-center py-2 px-1">
            <p className="font-display text-[11px] font-bold text-white leading-none">{count}</p>
            <p className="text-[8px] font-bold uppercase tracking-wider text-white/30 mt-0.5">#</p>
          </div>
        </div>
      </div>

    </div>
  );
}

