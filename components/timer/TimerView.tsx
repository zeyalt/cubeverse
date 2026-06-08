"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useScramble } from "@/lib/useScramble";
import { formatCs } from "@/lib/cubing";

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

export function TimerView({ event }: { event: TimerEvent }) {
  const { scramble, next: nextScramble } = useScramble(event.id);

  const [phase, setPhase] = useState<Phase>("idle");
  const [displayCs, setDisplayCs] = useState(0);
  const [penalty, setPenalty] = useState<Penalty>("none");
  const [inspSec, setInspSec] = useState(15);
  const [inspectionOn, setInspectionOn] = useState(false);

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

  function nextSolve() {
    go("idle");
    setDisplayCs(0);
    setPenalty("none");
    setInspSec(15);
    nextScramble();
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

  const scrambleVisible = phase !== "running";
  const showPenaltyBar  = phase === "stopped";
  const showHint        = phase === "idle" || phase === "holding" || phase === "ready";
  const hintText        = inspectionOn
    ? "Hold · release for inspection · tap to start"
    : "Hold 400 ms · release to start";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen bg-zinc-900 text-white flex flex-col select-none overflow-hidden"
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
        <Link
          href="/"
          className="p-2 -m-2 rounded-lg hover:bg-white/10 transition-colors"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <span className="font-semibold text-sm text-white/70">{event.name}</span>
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

      {/* Scramble */}
      <div
        className={`px-6 min-h-[5rem] flex items-center justify-center transition-opacity duration-300 ${
          scrambleVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className="text-white/55 text-sm text-center font-mono leading-loose tracking-wide">
          {scramble ?? "Generating scramble…"}
        </p>
      </div>

      {/* Timer display */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
        <p
          className={`font-black tabular-nums transition-colors duration-75 ${timeColour}`}
          style={{
            fontSize: "clamp(4rem, 20vw, 7rem)",
            letterSpacing: "-0.03em",
          }}
        >
          {timeText}
        </p>

        {showHint && (
          <p className="text-white/20 text-xs text-center max-w-xs mt-2">{hintText}</p>
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

      {/* Penalty bar */}
      {showPenaltyBar && (
        <div className="shrink-0 px-5 pb-10 space-y-3">
          <div className="flex gap-3">
            {(["none", "plus2", "dnf"] as Penalty[]).map((p) => (
              <button
                key={p}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={() => applyPenalty(p)}
                className={`flex-1 py-4 rounded-2xl text-sm font-bold transition-all ${
                  penalty === p
                    ? "bg-white text-zinc-900 scale-105 shadow-lg"
                    : "bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                {p === "none" ? "OK" : p === "plus2" ? "+2" : "DNF"}
              </button>
            ))}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={nextSolve}
              className="flex-1 py-4 rounded-2xl text-sm font-bold bg-white/10 text-red-400 hover:bg-red-500/20 transition-all"
            >
              Delete
            </button>
          </div>

          <button
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={nextSolve}
            className="w-full py-3 rounded-xl bg-white/5 text-white/30 text-sm hover:bg-white/10 transition-colors"
          >
            Next scramble →
          </button>
        </div>
      )}
    </div>
  );
}
