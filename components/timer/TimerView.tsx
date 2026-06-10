"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useScramble } from "@/lib/useScramble";
import { formatCs, DNF } from "@/lib/cubing";
import { recordSolve, type SessionStats } from "@/app/actions/solve";
import { enqueueSolve } from "@/lib/offline/queue";
import { getEventSticker } from "@/lib/event-theme";
import { SyncIndicator } from "@/components/SyncIndicator";
import { PbCelebration } from "./PbCelebration";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase =
  | "idle"        // waiting for hold
  | "holding"     // user pressing, < 400 ms
  | "ready"       // 400 ms elapsed, green, still pressing
  | "inspecting"  // 15-second inspection countdown
  | "running"     // timer live
  | "stopped";    // solve done, penalty bar visible

type Penalty = "none" | "plus2" | "dnf";

interface TimerEvent {
  id: string;
  name: string;
}

// ─── All mutable timer state lives here (avoids stale closure problems) ──────

interface TimerRefs {
  phase: Phase;
  startMs: number;
  finalCs: number;
  holdTimer: ReturnType<typeof setTimeout> | null;
  raf: number | null;
  inspTimer: ReturnType<typeof setInterval> | null;
  inspElapsed: number;  // seconds elapsed since inspection start
  inspPenalty: Penalty; // accrued from late inspection start
  inspectionOn: boolean;
}

function makeRefs(): TimerRefs {
  return {
    phase: "idle",
    startMs: 0,
    finalCs: 0,
    holdTimer: null,
    raf: null,
    inspTimer: null,
    inspElapsed: 0,
    inspPenalty: "none",
    inspectionOn: false,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TimerView({
  event,
  cuberId,
  cuberName,
  onBack,
}: {
  event: TimerEvent;
  cuberId: string;
  cuberName: string;
  onBack?: () => void;
}) {
  const { scramble, next: nextScramble } = useScramble(event.id);

  const [phase, setPhase] = useState<Phase>("idle");
  const [displayCs, setDisplayCs] = useState(0);
  const [penalty, setPenalty] = useState<Penalty>("none");
  const [inspSec, setInspSec] = useState(15);
  const [inspectionOn, setInspectionOn] = useState(false);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [pbSolve, setPbSolve] = useState<{ timeCs: number; badges: string[] } | null>(null);

  const t = useRef<TimerRefs>(makeRefs());

  // Sync inspectionOn toggle into ref so callbacks always see current value
  useEffect(() => {
    t.current.inspectionOn = inspectionOn;
  }, [inspectionOn]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function go(p: Phase) {
    t.current.phase = p;
    setPhase(p);
  }

  function clearHold() {
    if (t.current.holdTimer) {
      clearTimeout(t.current.holdTimer);
      t.current.holdTimer = null;
    }
  }

  function clearRAF() {
    if (t.current.raf) {
      cancelAnimationFrame(t.current.raf);
      t.current.raf = null;
    }
  }

  function clearInsp() {
    if (t.current.inspTimer) {
      clearInterval(t.current.inspTimer);
      t.current.inspTimer = null;
    }
  }

  // ── Timer actions ──────────────────────────────────────────────────────────

  const startRunning = useCallback(() => {
    clearInsp();
    // If started late during inspection, carry the accrued penalty
    const carriedPenalty = t.current.inspPenalty;
    t.current.inspPenalty = "none";

    t.current.startMs = performance.now();
    go("running");
    setDisplayCs(0);
    if ("vibrate" in navigator) navigator.vibrate(50);

    function tick() {
      setDisplayCs(Math.floor((performance.now() - t.current.startMs) / 10));
      t.current.raf = requestAnimationFrame(tick);
    }
    t.current.raf = requestAnimationFrame(tick);

    // Apply carried inspection penalty after stopping
    if (carriedPenalty !== "none") {
      t.current.inspPenalty = carriedPenalty;
    }
  }, []); // all reads via t.current refs — empty deps is correct

  const stopTimer = useCallback(() => {
    clearRAF();
    const cs = Math.floor((performance.now() - t.current.startMs) / 10);
    t.current.finalCs = cs;
    setDisplayCs(cs);
    setPenalty(t.current.inspPenalty);
    t.current.inspPenalty = "none";
    go("stopped");
    if ("vibrate" in navigator) navigator.vibrate(30);
  }, []); // all reads via t.current refs — empty deps is correct

  const startInspection = useCallback(() => {
    t.current.inspElapsed = 0;
    t.current.inspPenalty = "none";
    setInspSec(15);
    go("inspecting");

    t.current.inspTimer = setInterval(() => {
      t.current.inspElapsed += 1;
      const remaining = 15 - t.current.inspElapsed;
      setInspSec(remaining);

      if (t.current.inspElapsed === 15) {
        // Past 15s — accrued +2
        t.current.inspPenalty = "plus2";
      }
      if (t.current.inspElapsed >= 17) {
        // Past 17s — DNF; auto-stop
        clearInsp();
        t.current.inspPenalty = "none";
        t.current.finalCs = 0;
        setDisplayCs(0);
        setPenalty("dnf");
        go("stopped");
      }
    }, 1000);
  }, []); // all reads via t.current refs — empty deps is correct

  // ── Press / release (unified keyboard + touch) ─────────────────────────────

  const onPressStart = useCallback(() => {
    const p = t.current.phase;
    if (p === "running") { stopTimer(); return; }
    if (p === "inspecting") { startRunning(); return; }
    if (p !== "idle") return;
    go("holding");
    t.current.holdTimer = setTimeout(() => go("ready"), 400);
  }, [startRunning, stopTimer]);

  const onPressEnd = useCallback(() => {
    const p = t.current.phase;
    if (p === "ready") {
      clearHold();
      if (t.current.inspectionOn) { startInspection(); } else { startRunning(); }
      return;
    }
    if (p === "holding") {
      clearHold();
      go("idle");
    }
  }, [startInspection, startRunning]);

  // ── Keyboard listeners ─────────────────────────────────────────────────────

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

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => () => { clearHold(); clearRAF(); clearInsp(); }, []); // mount/unmount only

  // ── Penalty bar actions ────────────────────────────────────────────────────

  function applyPenalty(p: Penalty) { setPenalty(p); }

  function deleteSolve() {
    go("idle");
    setDisplayCs(0);
    setPenalty("none");
    setInspSec(15);
    nextScramble();
    // Solve was not yet persisted (we save on Next →), so nothing to delete.
  }

  function saveAndNext(chosenPenalty: Penalty) {
    const cs = t.current.finalCs;
    go("idle");
    setDisplayCs(0);
    setPenalty("none");
    setInspSec(15);
    nextScramble();

    const solveInput = {
      cuberId,
      eventId: event.id,
      timeCs: cs,
      penalty: chosenPenalty,
      scramble: scramble,
    };

    // Offline: queue locally; online: persist via server action.
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
        if (result.isPb && chosenPenalty !== "dnf") {
          const effCs = chosenPenalty === "plus2" ? cs + 200 : cs;
          setPbSolve({ timeCs: effCs, badges: result.newBadges });
        }
      })
      .catch((err) => {
        console.error("Failed to save solve, queuing offline:", err);
        enqueueSolve(solveInput).catch(console.error);
      });
  }

  // ── Derived display ────────────────────────────────────────────────────────

  let timeText: string;
  if (phase === "inspecting") {
    timeText = inspSec > 0 ? String(inspSec) : "+2";
  } else if (phase === "stopped") {
    if (penalty === "dnf") timeText = "DNF";
    else if (penalty === "plus2") timeText = formatCs(displayCs + 200) + "+";
    else timeText = formatCs(displayCs);
  } else {
    timeText = phase === "running" ? formatCs(displayCs) : "0.00";
  }

  const timeColour =
    phase === "holding"   ? "text-yellow-300" :
    phase === "ready"     ? "text-green-400"  :
    phase === "inspecting" && inspSec <= 3 ? "text-red-400"    :
    phase === "inspecting" && inspSec <= 7 ? "text-orange-400" :
    "text-white";

  const sticker = getEventSticker(event.id);
  const scrambleVisible = phase !== "running";
  const showPenaltyBar  = phase === "stopped";
  const showHint        = phase === "idle" || phase === "holding" || phase === "ready";
  const hintText        = inspectionOn
    ? "Hold · release for inspection · tap to start"
    : "Hold 400 ms · release to start";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="kid-canvas min-h-screen flex flex-col select-none overflow-hidden text-white"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("a, button")) return;
        e.preventDefault();
        onPressStart();
      }}
      onPointerUp={(e) => {
        if ((e.target as HTMLElement).closest("a, button")) return;
        onPressEnd();
      }}
      style={{ touchAction: "none" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-3 shrink-0">
        {onBack ? (
          <button
            onClick={onBack}
            className="sticker-ghost -m-1 rounded-lg bg-white/10 p-2.5 transition-transform active:scale-95"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <Link
            href="/"
            className="sticker-ghost -m-1 rounded-lg bg-white/10 p-2.5 transition-transform active:scale-95"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
        )}
        <div className="flex items-center gap-2">
          <SyncIndicator />
          <button
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              inspectionOn
                ? "bg-white/20 border-white/40 text-white"
                : "border-white/20 text-white/40 hover:border-white/40"
            }`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={() => setInspectionOn((v) => !v)}
          >
            Inspect
          </button>
        </div>
      </div>

      {/* Scramble */}
      <div
        className={`px-6 min-h-[5rem] flex items-center justify-center transition-opacity duration-300 ${
          scrambleVisible ? "opacity-100" : "opacity-0"
        } ${phase === "idle" ? "bg-white/5 rounded-lg py-4" : ""}`}
      >
        <p className={`font-mono-time text-center leading-loose tracking-wide ${
          phase === "idle" ? "text-base text-white/80" : "text-sm text-white/55"
        }`}>
          {scramble ?? "Generating scramble…"}
        </p>
      </div>

      {/* Timer display */}
      <div className={`flex-1 flex flex-col items-center justify-center gap-3 px-6 ${phase === "holding" ? "timer-holding" : ""}`}>
        <div className={`relative ${phase === "holding" || phase === "ready" ? "scale-110" : "scale-100"} transition-transform duration-75`}>
          <p
            className={`font-mono-time font-bold transition-colors duration-75 ${timeColour}`}
            style={{
              fontSize: "clamp(4rem, 20vw, 7rem)",
              letterSpacing: "-0.04em",
            }}
          >
            {timeText}
          </p>
          {phase === "ready" && (
            <div className="absolute inset-0 rounded-2xl border-2 border-green-400 opacity-50 animate-pulse" />
          )}
        </div>

        {showHint && (
          <p className="text-white/20 text-xs text-center max-w-xs mt-2 animate-pulse">{hintText}</p>
        )}

        {phase === "inspecting" && (
          <p
            className={`text-sm font-medium ${
              inspSec <= 3 ? "text-red-400" : inspSec <= 7 ? "text-orange-400" : "text-white/40"
            }`}
          >
            {inspSec <= 3 ? "Start now!" : inspSec <= 7 ? "⚠ Warning" : "Inspection"}
          </p>
        )}
      </div>

      {/* Session stats bar */}
      {stats && phase !== "running" && (
        <div className="shrink-0 flex justify-center gap-5 px-5 pb-2 font-mono-time text-xs text-white/40">
          <span>{stats.count} solve{stats.count !== 1 ? "s" : ""}</span>
          {stats.bestCs !== null && (
            <span>Best {stats.bestCs === DNF ? "DNF" : formatCs(stats.bestCs)}</span>
          )}
          {stats.ao5 !== null && (
            <span>Ao5 {stats.ao5 === DNF ? "DNF" : formatCs(stats.ao5)}</span>
          )}
          {stats.ao12 !== null && (
            <span>Ao12 {stats.ao12 === DNF ? "DNF" : formatCs(stats.ao12)}</span>
          )}
        </div>
      )}

      {/* PB celebration overlay */}
      {pbSolve && (
        <PbCelebration
          timeCs={pbSolve.timeCs}
          eventName={event.name}
          cuberName={cuberName}
          newBadges={pbSolve.badges}
          onDismiss={() => setPbSolve(null)}
        />
      )}

      {/* Penalty bar */}
      {showPenaltyBar && (
        <div className="shrink-0 space-y-3 px-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                { p: "none" as Penalty, label: "OK", face: "#009B48", ink: "#FFF" },
                { p: "plus2" as Penalty, label: "+2", face: "#FFD500", ink: "#1A1200" },
                { p: "dnf" as Penalty, label: "DNF", face: "#B71234", ink: "#FFF" },
              ] as const
            ).map(({ p, label, face, ink }) => (
              <button
                key={p}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={() => applyPenalty(p)}
                className={`rounded-xl border-2 py-4 text-sm font-bold transition-all ${
                  penalty === p ? "sticker -translate-y-0.5" : "border-white/20 bg-white/5 text-white"
                }`}
                style={
                  penalty === p
                    ? { backgroundColor: face, color: ink, borderColor: "#0A0A0A", boxShadow: "4px 4px 0 #0A0A0A" }
                    : undefined
                }
              >
                {label}
              </button>
            ))}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={deleteSolve}
              className="rounded-xl border-2 border-white/20 py-4 text-sm font-bold text-white/60 hover:bg-white/10"
            >
              Delete
            </button>
          </div>

          <button
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={() => saveAndNext(penalty)}
            className="sticker w-full rounded-xl py-4 font-display text-lg font-extrabold"
            style={{
              backgroundColor: sticker.face,
              color: sticker.ink,
              borderColor: "#0A0A0A",
              boxShadow: "4px 4px 0 #0A0A0A",
            }}
          >
            Next solve →
          </button>
        </div>
      )}
    </div>
  );
}
