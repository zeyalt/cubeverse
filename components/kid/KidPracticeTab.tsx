"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, Trash2, ArrowRight } from "lucide-react";
import { effectiveTime } from "@/lib/cubing";
import { currentAoN } from "@/lib/practiceStats";
import { EVENT_SHORT } from "@/lib/event-theme";
import { useScramble } from "@/lib/useScramble";
import { setEventCookie, setCubeCookie } from "@/lib/eventCookie";
import { cubeLabel } from "@/lib/cubeLabel";
import { ScramblePreview } from "./ScramblePreview";
import {
  TimerDisplay,
  type TimerDisplayHandle,
  type TimerPhase as TimerDisplayPhase,
  type Penalty as TimerDisplayPenalty,
} from "./TimerDisplay";
import { EventIcon } from "./EventIcon";
import { recordSolve, updateSolve, deleteSolve as deleteSolveAction } from "@/app/actions/solve";
import { enqueueSolve } from "@/lib/offline/queue";
import { bumpPendingCount } from "@/lib/offline/syncStore";
import { getPracticeSetupData, setPracticeGoal } from "@/app/actions/goals";
import { useKidData } from "./KidDataContext";

interface Event {
  id: string;
  name: string;
  format: string;
}

interface Cube {
  id: string;
  name: string;
  brand: string | null;
  event_id: string | null;
}

interface KidPracticeTabProps {
  events: Event[];
  defaultEventId: string;
  cuberId: string;
  cubes: Cube[];
  selectedCubeId: string | null;
  activeGoal: { id: string; target_cs: number } | null;
  ao5: number | null;
  ao12: number | null;
  ao50: number | null;
  ao100: number | null;
  best: number | null;
  count: number;
  recentTimes: number[];
}

// Shared with TimerDisplay so the phase/penalty vocabulary can't drift apart.
type TimerPhase = TimerDisplayPhase;
type Penalty = TimerDisplayPenalty;

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
  selectedCubeId: initialSelectedCubeId,
  activeGoal: initialGoal,
  recentTimes,
  best: initialBest,
  count: initialCount,
}: KidPracticeTabProps) {
  const [selectedId, setSelectedId] = useState(defaultEventId);
  const [, startTransition] = useTransition();
  const { invalidate } = useKidData();
  const { scramble, next: nextScramble } = useScramble(selectedId);

  // Recent effective times (DNF = -1) for the selected event — the server's
  // tail, appended to after each in-session solve so the rolling averages move
  // immediately without a page reload. This is deliberately NOT the full
  // history; see PRACTICE_TAIL.
  const [liveTimes, setLiveTimes] = useState<number[]>(recentTimes);

  // All-time best and attempt count, which the tail alone can't tell us. Held
  // as a baseline and combined with the session's solves below.
  const [baseBest, setBaseBest] = useState<number | null>(initialBest);
  const [baseCount, setBaseCount] = useState<number>(initialCount);
  // How long liveTimes was when the baseline was taken, so the session's net
  // additions can be counted. Part of the baseline, so it moves with it.
  const [baseLen, setBaseLen] = useState(recentTimes.length);

  // Resync if the server sends a fresh list (e.g. after navigation/refresh).
  // Intentionally mirrors the incoming props into local state.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLiveTimes(recentTimes);
    setBaseBest(initialBest);
    setBaseCount(initialCount);
    setBaseLen(recentTimes.length);
  }, [recentTimes, initialBest, initialCount]);

  const ao5 = currentAoN(liveTimes, 5);
  const ao12 = currentAoN(liveTimes, 12);
  const ao50 = currentAoN(liveTimes, 50);
  const ao100 = currentAoN(liveTimes, 100);

  // The tail is a subset of all-time, so the min over it can only improve on
  // the server's baseline when this session has set a new PB.
  const sessionNonDnf = liveTimes.filter((t) => t > 0);
  const best =
    sessionNonDnf.length > 0
      ? Math.min(baseBest ?? Number.POSITIVE_INFINITY, ...sessionNonDnf)
      : baseBest;
  const count = baseCount + (liveTimes.length - baseLen);

  const [timerPhase, setTimerPhase] = useState<TimerPhase>("idle");
  // The *stopped* solve's time. The running time is not React state — it goes
  // straight to the DOM via timerDisplayRef, so a solve no longer re-renders
  // this whole screen once per animation frame.
  const [displayCs, setDisplayCs] = useState(0);
  const timerDisplayRef = useRef<TimerDisplayHandle>(null);
  const [penalty, setPenalty] = useState<Penalty>("none");
  const [inspSec, setInspSec] = useState(15);
  const [showHoldMsg, setShowHoldMsg] = useState(false);
  const holdMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cube + Goal state
  const [cubes, setCubes] = useState<Cube[]>(initialCubes);
  const [selectedCubeId, setSelectedCubeId] = useState<string | null>(initialSelectedCubeId);
  const [activeGoal, setActiveGoal] = useState(initialGoal);
  // While the target field is being typed, hold the raw string so the controlled
  // value doesn't reformat/snap on every keystroke. Committed on blur/Enter.
  const [targetDraft, setTargetDraft] = useState<string | null>(null);
  const [eventDropdownOpen, setEventDropdownOpen] = useState(false);
  const [cubeDropdownOpen, setCubeDropdownOpen] = useState(false);

  const timerRef = useRef<TimerRefs>(makeTimerRefs());
  // Id of the solve recorded on the most recent stop, so the post-stop
  // penalty/delete controls can edit or remove it.
  const lastSolveIdRef = useRef<string | null>(null);
  // Guards against persisting the same stop twice (effect re-entrancy).
  const recordedThisStopRef = useRef(false);
  // Post-solve controls stay locked for a beat after stopping, so the stopping
  // tap can't accidentally hit delete/+2/DNF/next.
  const [controlsReady, setControlsReady] = useState(false);
  // Surfaces the reason a solve failed to save (instead of silently dropping it).
  const [saveError, setSaveError] = useState<string | null>(null);

  // Debounce + generation guard for target-time saves. Rapid +/- taps used to
  // fire one persist-then-refetch chain per tap; because those chains resolved
  // out of order, a stale response could land after a newer one and snap the
  // displayed target back to an older value (and keep "drifting" for a few
  // seconds after the user stopped tapping). Now only the trailing edge of a
  // burst is persisted, and a stale in-flight response is discarded.
  const targetSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetSaveGen = useRef(0);

  // Same out-of-order hazard as the target-time save above: switching events
  // twice in quick succession fires two concurrent fetches, and without this
  // guard a slower response for the *first* event could land after the
  // second and overwrite its cubes/goal/metrics with the wrong event's data.
  const eventSwitchGen = useRef(0);

  function handleSelectEvent(id: string) {
    setSelectedId(id);
    setSelectedCubeId(null);
    setCubeCookie(null); // cubes differ per puzzle — clear the persisted cube
    setEventCookie(id); // share selection with analytics / cubes / timer
    const gen = ++eventSwitchGen.current;
    startTransition(async () => {
      const setup = await getPracticeSetupData(cuberId, id);
      if (gen !== eventSwitchGen.current) return; // superseded by a later switch
      setCubes(setup.cubes);
      setActiveGoal(setup.activeGoal);
      applySetupTimes(setup);
    });
  }

  /**
   * Reseed the metric baseline from the server.
   *
   * `best` and `count` describe the whole history while `liveTimes` is only its
   * tail, so the client can adjust them for solves it *adds* but not for ones it
   * removes or slows down — deleting the all-time best would otherwise leave the
   * old PB on screen. Those cases re-read the truth instead of guessing.
   */
  function applySetupTimes(setup: {
    recentTimes: number[];
    best: number | null;
    count: number;
  }) {
    setLiveTimes(setup.recentTimes);
    setBaseBest(setup.best);
    setBaseCount(setup.count);
    setBaseLen(setup.recentTimes.length);
  }

  function reloadStats() {
    const gen = eventSwitchGen.current;
    startTransition(async () => {
      const setup = await getPracticeSetupData(cuberId, selectedId);
      if (gen !== eventSwitchGen.current) return;
      applySetupTimes(setup);
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
      timerDisplayRef.current?.set(
        Math.floor((performance.now() - timerRef.current.startMs) / 10)
      );
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

  // Persist the solve the instant it's stopped (not on "Next"). The post-stop
  // controls then edit (updateSolve) or remove (deleteSolve) this saved row.
  function persistSolve(chosenPenalty: Penalty) {
    const cs = timerRef.current.finalCs;
    const currentScramble = scramble || "";
    lastSolveIdRef.current = null;
    setSaveError(null);

    // Roll the live metrics forward immediately with this solve's effective time.
    setLiveTimes((prev) => [...prev, effectiveTime(cs, chosenPenalty)]);

    const solveInput = {
      cuberId,
      eventId: selectedId,
      timeCs: cs,
      penalty: chosenPenalty,
      scramble: currentScramble,
      ...(selectedCubeId && { cubeId: selectedCubeId }),
    };

    if (!navigator.onLine) {
      enqueueSolve(solveInput)
        .then(bumpPendingCount)
        .catch((err) => console.error("Failed to queue solve:", err));
      return;
    }

    recordSolve(solveInput)
      .then((result) => {
        if (result.error) {
          // Server reached but rejected the save. Not queued for retry: the
          // rejection can happen *after* the row was already inserted (e.g. a
          // badge/PB-check step throws), so blindly retrying risks writing a
          // duplicate solve. Since this one won't be retried, roll back the
          // optimistic metric bump — leaving it in would keep showing an
          // average that includes a solve that was never actually saved,
          // which is the confusing half of "it helped my average" reports.
          console.error("[recordSolve] error:", result.error, solveInput);
          setSaveError(result.error);
          setLiveTimes((prev) => prev.slice(0, -1));
          return;
        }
        setSaveError(null);
        lastSolveIdRef.current = result.solveId;
        // The charts and badge progress now include this solve. Practice is
        // excluded: it already rolled its own metrics forward optimistically.
        invalidate("analytics", "badges");
      })
      .catch((err) => {
        // Thrown before a response came back — the row was never inserted,
        // so queuing for retry is safe (no duplicate risk) and the optimistic
        // metric bump can stay, since the sync loop will make it real.
        console.error("Failed to save solve, queuing offline:", err);
        setSaveError((err as Error)?.message ?? "Could not reach the server — solve queued offline.");
        enqueueSolve(solveInput).then(bumpPendingCount).catch(console.error);
      });
  }

  // Toggle a penalty on the already-saved solve: update the live metric and the
  // persisted row.
  function applyPenalty(chosenPenalty: Penalty) {
    setPenalty(chosenPenalty);
    const cs = timerRef.current.finalCs;
    const wasBest = liveTimes.length > 0 && liveTimes[liveTimes.length - 1] === best;
    setLiveTimes((prev) => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      copy[copy.length - 1] = effectiveTime(cs, chosenPenalty);
      return copy;
    });
    const id = lastSolveIdRef.current;
    if (id) updateSolve(id, cs, chosenPenalty).catch(console.error);
    invalidate("analytics", "badges");
    // Penalising the current PB makes the cached baseline wrong.
    if (wasBest) reloadStats();
  }

  // Discard the just-recorded solve (deletes the saved row + rolls metrics back).
  function discardSolve() {
    const id = lastSolveIdRef.current;
    if (id) deleteSolveAction(id).catch(console.error);
    lastSolveIdRef.current = null;
    const wasBest = liveTimes.length > 0 && liveTimes[liveTimes.length - 1] === best;
    setLiveTimes((prev) => prev.slice(0, -1));
    invalidate("analytics", "badges");
    // Discarding the current PB makes the cached baseline wrong.
    if (wasBest) reloadStats();
    goPhase("idle");
    setDisplayCs(0);
    setPenalty("none");
    setInspSec(15);
    nextScramble();
  }

  // Advance to the next solve (the row was already saved on stop).
  function next() {
    lastSolveIdRef.current = null;
    goPhase("idle");
    setDisplayCs(0);
    setPenalty("none");
    setInspSec(15);
  }

  // Target time bounds: 3.00s … 30:00 (in centiseconds).
  const TARGET_MIN_CS = 300;
  const TARGET_MAX_CS = 180000;

  function saveTarget(cs: number) {
    // Optimistic UI: reflect the new target immediately so +/- feels instant.
    setActiveGoal((prev) => ({ id: prev?.id ?? "", target_cs: cs }));

    // Debounce the actual write to the trailing edge of a tap burst — sending
    // one request per tap was the source of the out-of-order race. Bump the
    // generation so any earlier in-flight save can be told it's stale.
    const gen = ++targetSaveGen.current;
    if (targetSaveTimer.current) clearTimeout(targetSaveTimer.current);
    targetSaveTimer.current = setTimeout(() => {
      void setPracticeGoal(cuberId, selectedId, cs).then((result) => {
        if (gen !== targetSaveGen.current) return; // superseded by a later save
        if (result.error) console.error("[setPracticeGoal] failed:", result.error);
        // The target line on the Solves Over Time chart comes from this goal.
        else invalidate("analytics");
      });
    }, 400);
  }

  // Commit the typed target draft (clamped to bounds) when the field loses focus.
  function commitTargetDraft() {
    if (targetDraft === null) return;
    const val = parseFloat(targetDraft);
    if (!isNaN(val) && val > 0) {
      const cs = Math.min(TARGET_MAX_CS, Math.max(TARGET_MIN_CS, Math.round(val * 100)));
      saveTarget(cs);
    }
    setTargetDraft(null);
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (timerPhase === "stopped") {
      // Record the solve the moment it stops, then prepare the next scramble.
      if (!recordedThisStopRef.current) {
        recordedThisStopRef.current = true;
        persistSolve(penalty);
        nextScramble();
      }
      // Lock the post-solve controls briefly so the stopping tap can't trigger
      // one of them by accident; they arm after a short delay.
      setControlsReady(false);
      const t = setTimeout(() => setControlsReady(true), 450);
      return () => clearTimeout(t);
    }
    recordedThisStopRef.current = false;
    setControlsReady(false);
    // Fire only on timer-phase transitions; the other values are captured fresh
    // from the render that flipped the phase to "stopped".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerPhase]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden text-white">

      {/* Save-error banner — surfaces why a solve wasn't recorded. */}
      {saveError && (
        <div className="fixed left-1/2 top-2 z-[60] w-[92%] max-w-sm -translate-x-1/2 rounded-lg border border-red-500/50 bg-red-950/95 px-3 py-2 text-xs font-medium text-red-100 shadow-lg pointer-events-auto">
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 break-words">Solve not saved — {saveError}</span>
            <button onClick={() => setSaveError(null)} className="shrink-0 text-red-200/70 hover:text-red-100" aria-label="Dismiss">✕</button>
          </div>
        </div>
      )}

      {/* ── Compact setup bar — event + cube dropdowns + session-setup chip ──── */}
      <div className="practice-setup relative z-50 flex shrink-0 flex-col gap-3 px-2 pt-2 pb-2 pointer-events-none">
        {/* Controls row */}
        <div className="flex gap-2 pointer-events-auto">
          {/* Event dropdown */}
          <div className="relative flex-[0.95] min-w-0">
            <button
              onClick={() => setEventDropdownOpen(!eventDropdownOpen)}
              className="sticker w-full h-12 flex items-center justify-between gap-1 rounded-lg border-2 border-white/20 bg-[#1C1916] px-2.5 font-bold text-[11px] text-white transition-all hover:bg-white/10"
            >
              <span className="flex flex-1 min-w-0 items-center gap-1.5">
                <EventIcon event={selectedId} className="shrink-0 text-base" />
                <span className="truncate text-left">{EVENT_SHORT[selectedId] || selectedId}</span>
              </span>
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
                    className={`w-full flex items-center gap-2 text-left px-3 py-2 font-bold text-sm transition-colors ${
                      selectedId === ev.id
                        ? "bg-[#FFD500]/20 text-[#FFD500]"
                        : "text-white hover:bg-white/10"
                    }`}
                  >
                    <EventIcon event={ev.id} className="shrink-0 text-base" />
                    {EVENT_SHORT[ev.id] || ev.id}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cube dropdown */}
          <div className="relative flex-[0.95] min-w-0">
            <button
              onClick={() => setCubeDropdownOpen(!cubeDropdownOpen)}
              className="sticker w-full h-12 flex items-center justify-between gap-1 rounded-lg border-2 border-white/20 bg-[#1C1916] px-2.5 font-bold text-[11px] text-white transition-all hover:bg-white/10"
            >
              <span className="truncate text-left flex-1 min-w-0">
                {(() => {
                  const c = selectedCubeId ? cubes.find((c) => c.id === selectedCubeId) : null;
                  return c ? cubeLabel(c) : "Any Cube";
                })()}
              </span>
              <ChevronDown className={`size-4 flex-shrink-0 transition-transform ${cubeDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {cubeDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 z-50 rounded-lg border border-white/10 bg-[#1C1916] shadow-lg max-h-48 overflow-y-auto min-w-[180px]">
                <button
                  onClick={() => {
                    setSelectedCubeId(null);
                    setCubeCookie(null);
                    setCubeDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 font-bold text-sm transition-colors ${
                    selectedCubeId === null
                      ? "bg-[#FFD500]/20 text-[#FFD500]"
                      : "text-white hover:bg-white/10"
                  }`}
                >
                  Any Cube
                </button>
                {cubes.map((cube) => (
                  <button
                    key={cube.id}
                    onClick={() => {
                      setSelectedCubeId(cube.id);
                      setCubeCookie(cube.id);
                      setCubeDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 font-bold text-sm transition-colors ${
                      selectedCubeId === cube.id
                        ? "bg-[#FFD500]/20 text-[#FFD500]"
                        : "text-white hover:bg-white/10"
                    }`}
                  >
                    {cubeLabel(cube)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Target time input — unique per puzzle type */}
          <div className="relative flex-[1.15] min-w-0">
            <div className="sticker h-12 border-2 border-white/20 bg-[#1C1916] rounded-lg px-1.5 flex items-center gap-1">
              <button
                onClick={() => {
                  const currentCs = activeGoal?.target_cs ?? 1000;
                  if (currentCs > TARGET_MIN_CS) {
                    saveTarget(Math.max(TARGET_MIN_CS, Math.round(currentCs - 100)));
                  }
                }}
                className="flex items-center justify-center w-8 h-8 shrink-0 rounded-md bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors [touch-action:manipulation]"
                aria-label="Decrease target by 1s"
                title="−1s"
              >
                −
              </button>
              <input
                type="text"
                inputMode="decimal"
                value={targetDraft !== null ? targetDraft : activeGoal ? (activeGoal.target_cs / 100).toFixed(2) : "10.00"}
                onFocus={() => setTargetDraft(activeGoal ? (activeGoal.target_cs / 100).toFixed(2) : "10.00")}
                onChange={(e) => setTargetDraft(e.target.value)}
                onBlur={commitTargetDraft}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                className="min-w-0 flex-1 bg-transparent text-center text-[11px] font-mono-time font-bold text-white placeholder-white/30 focus:outline-none"
                placeholder="10.00"
              />
              <button
                onClick={() => {
                  const currentCs = activeGoal?.target_cs ?? 1000;
                  if (currentCs < TARGET_MAX_CS) {
                    saveTarget(Math.min(TARGET_MAX_CS, Math.round(currentCs + 100)));
                  }
                }}
                className="flex items-center justify-center w-8 h-8 shrink-0 rounded-md bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors [touch-action:manipulation]"
                aria-label="Increase target by 1s"
                title="+1s"
              >
                +
              </button>
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
            className="kid-animate-in flex items-center gap-3 rounded-lg bg-white/5 w-full max-w-sm mx-auto px-4 py-2 select-none"
            style={{ animationDelay: "80ms", userSelect: "none", WebkitUserSelect: "none" }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <p
              className="font-mono-time flex-1 text-left text-[15px] leading-snug tracking-wide text-white/75"
              style={{ userSelect: "none", WebkitUserSelect: "none" }}
            >
              {scramble ?? "Generating scramble…"}
            </p>
            <ScramblePreview
              event={selectedId}
              scramble={scramble}
              className="h-32 w-48 shrink-0"
            />
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
            <TimerDisplay
              ref={timerDisplayRef}
              phase={timerPhase}
              inspSec={inspSec}
              penalty={penalty}
              finalCs={displayCs}
            />
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
            <div
              className="mt-6 space-y-3 mx-auto w-full max-w-sm transition-opacity duration-200"
              style={{
                pointerEvents: controlsReady ? "auto" : "none",
                opacity: controlsReady ? 1 : 0.4,
              }}
            >
              <div className="flex gap-2 items-center justify-center">
                <button
                  onClick={() => discardSolve()}
                  className="flex items-center justify-center w-14 h-14 rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20 [touch-action:manipulation]"
                  aria-label="Delete solve"
                >
                  <Trash2 className="size-6" />
                </button>
                <button
                  onClick={() => applyPenalty(penalty === "plus2" ? "none" : "plus2")}
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
                  onClick={() => applyPenalty(penalty === "dnf" ? "none" : "dnf")}
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
                  onClick={() => next()}
                  className="flex items-center justify-center w-14 h-14 rounded-lg bg-white/20 text-white transition-colors hover:bg-white/30 [touch-action:manipulation]"
                  aria-label="Next solve"
                >
                  <ArrowRight className="size-4" />
                </button>
              </div>
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

