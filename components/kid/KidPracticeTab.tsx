"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { X, Target, PartyPopper, SlidersHorizontal, ChevronDown, Trash2, ArrowRight } from "lucide-react";
import { formatCs, parseToCs, effectiveTime, aoN, DNF } from "@/lib/cubing";
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
  recentTimes: number[];
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
  recentTimes,
}: KidPracticeTabProps) {
  const [selectedId, setSelectedId] = useState(defaultEventId);
  const [, startTransition] = useTransition();
  const { scramble, next: nextScramble } = useScramble(selectedId);

  // Live list of effective times (DNF = -1) for the selected event. Seeded from
  // the server and appended to after each in-session solve so the 6 bottom
  // metrics roll forward immediately without a page reload.
  const [liveTimes, setLiveTimes] = useState<number[]>(recentTimes);

  // Resync if the server sends a fresh list (e.g. after navigation/refresh).
  // Intentionally mirrors the incoming prop into local state.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLiveTimes(recentTimes);
  }, [recentTimes]);

  // Current rolling average of the last N times (WCA rules, matches the server).
  const currentAoN = useCallback((n: number): number | null => {
    if (liveTimes.length < n) return null;
    const result = aoN(liveTimes.slice(-n));
    return result === DNF ? null : result;
  }, [liveTimes]);

  const nonDnf = liveTimes.filter((t) => t > 0);
  const ao5 = currentAoN(5);
  const ao12 = currentAoN(12);
  const ao50 = currentAoN(50);
  const ao100 = currentAoN(100);
  const best = nonDnf.length > 0 ? Math.min(...nonDnf) : null;
  const count = liveTimes.length;

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
  const [eventDropdownOpen, setEventDropdownOpen] = useState(false);
  const [cubeDropdownOpen, setCubeDropdownOpen] = useState(false);

  const timerRef = useRef<TimerRefs>(makeTimerRefs());

  function handleSelectEvent(id: string) {
    setSelectedId(id);
    setSelectedCubeId(null);
    setEditingGoal(false);
    startTransition(async () => {
      const setup = await getPracticeSetupData(cuberId, id);
      setCubes(setup.cubes);
      setActiveGoal(setup.activeGoal);
      setLiveTimes(setup.recentTimes);
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

    // Record press start time for tap detection
    timerRef.current.startMs = Date.now();

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
    const pressDuration = Date.now() - timerRef.current.startMs;
    const isQuickTap = pressDuration < 150; // Quick tap threshold

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
      // Quick tap: directly start inspection without waiting for "ready" state
      if (isQuickTap && timerRef.current.phase === "holding") {
        startInspection();
        return;
      }
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

  useEffect(() => {
    if (timerPhase === "stopped") {
      nextScramble();
    }
  }, [timerPhase]);

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

    // Roll the 6 metrics forward immediately with this solve's effective time.
    setLiveTimes((prev) => [...prev, effectiveTime(cs, chosenPenalty)]);

    goPhase("idle");
    setDisplayCs(0);
    setPenalty("none");
    setInspSec(15);

    const solveInput = {
      cuberId,
      eventId: selectedId,
      timeCs: cs,
      penalty: chosenPenalty,
      scramble: currentScramble,
      ...(selectedCubeId && { cubeId: selectedCubeId }),
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
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden text-white">

      {/* ── Compact setup bar — event + cube dropdowns + session-setup chip ──── */}
      <div className="practice-setup relative z-50 flex shrink-0 flex-col gap-2 px-4 pt-2 pb-2 pointer-events-none">
        <div className="flex gap-2 pointer-events-auto">
          {/* Event dropdown */}
          <div className="relative flex-1">
            <button
              onClick={() => setEventDropdownOpen(!eventDropdownOpen)}
              className="sticker w-full flex items-center justify-between rounded-lg border-2 border-white/20 bg-[#1C1916] px-3 py-2 font-bold text-sm text-white transition-all hover:bg-white/10"
            >
              <span className="truncate text-left">{EVENT_SHORT[selectedId] || selectedId}</span>
              <ChevronDown className={`size-4 flex-shrink-0 transition-transform ${eventDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {eventDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-white/10 bg-[#1C1916] shadow-lg max-h-48 overflow-y-auto">
                {events.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => {
                      handleSelectEvent(ev.id);
                      setEventDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 font-bold text-sm transition-colors ${
                      selectedId === ev.id
                        ? "bg-[#FFD500]/20 text-[#FFD500]"
                        : "text-white hover:bg-white/10"
                    }`}
                  >
                    {EVENT_SHORT[ev.id] || ev.id}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cube dropdown */}
          <div className="relative flex-1">
            <button
              onClick={() => setCubeDropdownOpen(!cubeDropdownOpen)}
              className="sticker w-full flex items-center justify-between rounded-lg border-2 border-white/20 bg-[#1C1916] px-3 py-2 font-bold text-sm text-white transition-all hover:bg-white/10"
            >
              <span className="truncate text-left">
                {selectedCubeId
                  ? cubes.find((c) => c.id === selectedCubeId)?.name || "Cube"
                  : "Any"}
              </span>
              <ChevronDown className={`size-4 flex-shrink-0 transition-transform ${cubeDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {cubeDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 z-50 rounded-lg border border-white/10 bg-[#1C1916] shadow-lg max-h-48 overflow-y-auto min-w-[180px]">
                <button
                  onClick={() => {
                    setSelectedCubeId(null);
                    setCubeDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 font-bold text-sm transition-colors ${
                    selectedCubeId === null
                      ? "bg-[#FFD500]/20 text-[#FFD500]"
                      : "text-white hover:bg-white/10"
                  }`}
                >
                  Any
                </button>
                {cubes.map((cube) => (
                  <button
                    key={cube.id}
                    onClick={() => {
                      setSelectedCubeId(cube.id);
                      setCubeDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 font-bold text-sm transition-colors ${
                      selectedCubeId === cube.id
                        ? "bg-[#FFD500]/20 text-[#FFD500]"
                        : "text-white hover:bg-white/10"
                    }`}
                  >
                    {cube.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Target time input */}
          <div className="relative flex-1">
            <div className="relative">
              <Target className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#FFD500] pointer-events-none" />
              <input
                type="text"
                placeholder="Target"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                onBlur={async () => {
                  if (goalInput.trim()) {
                    try {
                      const cs = Math.round(parseFloat(goalInput) * 100);
                      if (cs > 0) {
                        await setPracticeGoal(cuberId, selectedId, cs);
                        const setup = await getPracticeSetupData(cuberId, selectedId);
                        setActiveGoal(setup.activeGoal);
                      }
                    } catch (err) {
                      console.error("Failed to set goal:", err);
                    }
                  } else {
                    await clearPracticeGoal(cuberId, selectedId);
                    setActiveGoal(null);
                  }
                  setGoalInput("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="sticker w-full flex items-center rounded-lg border-2 border-white/20 bg-[#1C1916] px-3 py-2 pl-9 font-mono-time text-sm text-[#FFD500] transition-all hover:bg-white/10 focus:outline-none focus:border-[#FFD500]/50 placeholder:text-white/40"
              />
              {activeGoal && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/50">
                  {(activeGoal.target_cs / 100).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* ── Hero ───────────────────────────────────────────────────────────
          One flex column that fills the space between the setup bar and the
          metrics strip. Scramble sits at the top, the timer is centred in the
          leftover space, and post-solve controls sit below — so nothing can
          overlap on any viewport (portrait, landscape, tablet, desktop).
          The whole region is the tap target for starting inspection. */}
      <div
        className="relative z-10 flex min-h-0 flex-1 flex-col px-5"
        style={{
          // Disable taps while the solve is stopped so the penalty / Delete /
          // Next buttons are usable without re-triggering inspection.
          pointerEvents: timerPhase === "stopped" ? "none" : "auto",
          touchAction: "none",
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          onPressStart();
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          onPressEnd();
        }}
      >
        {/* Scramble — pinned to the top of the hero */}
        <div className="practice-scramble shrink-0 pt-1 pointer-events-none">
          <div
            className="kid-animate-in rounded-lg bg-white/5 w-full max-w-sm mx-auto px-4 py-2 select-none"
            style={{ animationDelay: "80ms", userSelect: "none", WebkitUserSelect: "none" }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <p
              className="font-mono-time text-center text-[15px] leading-snug tracking-wide text-white/75"
              style={{ userSelect: "none", WebkitUserSelect: "none" }}
            >
              {scramble ?? "Generating scramble…"}
            </p>
          </div>
        </div>

        {/* Timer — centred in the space that remains between scramble and
            post-solve controls. flex-1 means it always gets the leftover room. */}
        <div className="kid-animate-in flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden" style={{ animationDelay: "80ms" }}>
          <div className="w-full max-w-sm mx-auto">

          {/* Timer display */}
          <div
            className="w-full cursor-pointer select-none text-center"
          >
            <p className="timer-display font-mono-time font-semibold leading-none tracking-tighter select-none" style={{ userSelect: "none", WebkitUserSelect: "none" }}>
              {timerPhase === "inspecting" || timerPhase === "holding" || timerPhase === "ready"
                ? inspSec > 0 ? String(inspSec) : "+2"
                : timerPhase === "stopped"
                ? penalty === "dnf" ? "DNF" : penalty === "plus2" ? formatCs(displayCs + 200) + "+" : formatCs(displayCs)
                : timerPhase === "running"
                ? formatCs(displayCs)
                : "0.00"}
            </p>
            <p className="practice-hint mt-3 text-sm text-white/45 select-none" style={{ userSelect: "none", WebkitUserSelect: "none" }}>
              {(() => {
                // The live timer reads its ref during render on purpose to pick
                // the correct hint for the current phase.
                /* eslint-disable react-hooks/refs */
                if (timerPhase === "inspecting") return inspSec <= 3 ? "Start now!" : "Inspecting…";
                if (timerPhase === "holding") return timerRef.current.inspTimer ? "" : (showHoldMsg ? "Release to start inspection" : "");
                if (timerPhase === "ready") return timerRef.current.inspTimer ? "Release to start" : "Release to start inspection";
                if (timerPhase === "running") return "";
                if (timerPhase === "stopped") return "";
                return "Tap to start inspection";
                /* eslint-enable react-hooks/refs */
              })()}
            </p>
          </div>

          {/* Penalty bar + session stats */}
          {timerPhase === "stopped" && (
            <div className="mt-6 space-y-3 mx-auto w-full max-w-sm pointer-events-auto">
              <div className="flex gap-2 items-center justify-center">
                <button
                  onClick={() => deleteSolve()}
                  className="flex items-center justify-center w-14 h-14 rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20 [touch-action:manipulation]"
                  aria-label="Delete solve"
                >
                  <Trash2 className="size-6" />
                </button>
                <button
                  onClick={() => setPenalty(penalty === "plus2" ? "none" : "plus2")}
                  className="flex items-center justify-center w-14 h-14 rounded-lg font-bold text-lg transition-all [touch-action:manipulation]"
                  style={{
                    backgroundColor: penalty === "plus2" ? "#FFD500" : "rgba(255,213,0,0.3)",
                    color: penalty === "plus2" ? "#1A1200" : "#FFD500",
                    boxShadow: penalty === "plus2" ? "3px 3px 0 #0A0A0A" : "1px 1px 0 rgba(255,213,0,0.2)",
                  }}
                >
                  +2
                </button>
                <button
                  onClick={() => setPenalty(penalty === "dnf" ? "none" : "dnf")}
                  className="flex items-center justify-center w-14 h-14 rounded-lg font-bold text-lg transition-all [touch-action:manipulation]"
                  style={{
                    backgroundColor: penalty === "dnf" ? "#B71234" : "rgba(183,18,52,0.3)",
                    color: penalty === "dnf" ? "#FFF" : "#B71234",
                    boxShadow: penalty === "dnf" ? "3px 3px 0 #0A0A0A" : "1px 1px 0 rgba(183,18,52,0.2)",
                  }}
                >
                  DNF
                </button>
                <button
                  onClick={() => saveAndNext(penalty)}
                  className="flex items-center justify-center w-14 h-14 rounded-lg bg-white/20 text-white transition-colors hover:bg-white/30 [touch-action:manipulation]"
                  aria-label="Next solve"
                >
                  <ArrowRight className="size-4" />
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
                    <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs font-bold text-[#FFD500] animate-bounce">
                      <PartyPopper className="size-3.5" />
                      NEW PB!
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Stats strip — in-flow at the bottom of the practice column, directly
          above the bottom nav. shrink-0 so it always keeps its height. */}
      <div
        className="practice-metrics shrink-0 border-t border-white/8 kid-animate-in select-none"
        style={{
          background: "rgba(10,10,10,0.88)",
          animationDelay: "200ms",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="grid grid-cols-6 divide-x divide-white/8">
          {([
            { label: "ao5",   value: ao5 },
            { label: "ao12",  value: ao12 },
            { label: "ao50",  value: ao50 },
            { label: "ao100", value: ao100 },
            { label: "best",  value: best },
          ] as const).map(({ label, value }) => (
            <div
              key={label}
              className="practice-metric-cell flex flex-col items-center py-2.5 px-1 select-none"
              style={{ userSelect: "none", WebkitUserSelect: "none" }}
            >
              <p
                className="font-mono-time text-xs font-bold text-white leading-none"
                style={{ userSelect: "none", WebkitUserSelect: "none" }}
              >
                {value ? (value / 100).toFixed(2) : "—"}
              </p>
              <p
                className="text-[9px] font-bold uppercase tracking-wider text-white/40 mt-1"
                style={{ userSelect: "none", WebkitUserSelect: "none" }}
              >
                {label}
              </p>
            </div>
          ))}
          <div
            className="practice-metric-cell flex flex-col items-center py-2.5 px-1 select-none"
            style={{ userSelect: "none", WebkitUserSelect: "none" }}
          >
            <p
              className="font-display text-xs font-bold text-white leading-none"
              style={{ userSelect: "none", WebkitUserSelect: "none" }}
            >
              {count}
            </p>
            <p
              className="text-[9px] font-bold uppercase tracking-wider text-white/40 mt-1"
              style={{ userSelect: "none", WebkitUserSelect: "none" }}
            >
              #
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}

