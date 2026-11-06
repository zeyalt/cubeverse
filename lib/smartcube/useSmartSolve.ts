"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useScramble } from "@/lib/useScramble";
import { scrambledFacelets } from "./convert";
import { analyseSolve, type SolveAnalysis } from "./analysis";
import {
  INITIAL_SOLVE,
  reduceSolve,
  solveTimeCs,
  type SolveEvent,
  type SolveState,
} from "./solveMachine";
import { subscribeEvents, subscribeMoves, useSmartCube } from "./useSmartCube";
import type { TimedMove } from "./moveStream";

/**
 * Drives one solve: hand out a scramble, watch the cube reach it, run inspection, time the solve
 * from the cube's own clock, and analyse it the moment it's solved.
 *
 * The state machine itself is pure (`solveMachine.ts`); this only feeds it real events and owns
 * the timers React needs.
 */

export interface CompletedSolve {
  id: string;
  scramble: string;
  scrambledState: string;
  timeCs: number | null;
  penalty: SolveState["penalty"];
  moves: TimedMove[];
  analysis: SolveAnalysis;
  timingSource: SolveState["timingSource"];
  resynced: boolean;
  solvedAt: string;
}

/**
 * Finished solves live at module level, like the connection itself, so switching tabs mid-session
 * doesn't throw away the session's history. Persisting them to Supabase comes next; until then
 * this is deliberately session-only, and the UI says so rather than implying they're saved.
 */
let history: CompletedSolve[] = [];
const historyListeners = new Set<() => void>();
const emitHistory = () => {
  for (const listener of [...historyListeners]) listener();
};
const subscribeHistory = (listener: () => void) => {
  historyListeners.add(listener);
  return () => {
    historyListeners.delete(listener);
  };
};

export function clearHistory(): void {
  history = [];
  emitHistory();
}

const INSPECTION_TICK_MS = 100;

export function useSmartSolve(eventId = "333") {
  const cube = useSmartCube();
  const { scramble, next: nextScramble } = useScramble(eventId);
  const [solve, setSolve] = useState<SolveState>(INITIAL_SOLVE);
  const [inspectionMs, setInspectionMs] = useState(0);
  const [liveMs, setLiveMs] = useState(0);

  const solves = useSyncExternalStore(
    subscribeHistory,
    () => history,
    () => history
  );

  // The reducer is driven from cube callbacks, which don't re-render in step with React, so the
  // current state is mirrored in a ref for them to read.
  const solveRef = useRef(solve);
  const dispatch = useCallback((event: SolveEvent) => {
    const next = reduceSolve(solveRef.current, event);
    if (next === solveRef.current) return;
    solveRef.current = next;
    setSolve(next);
  }, []);

  // A new scramble resets the machine. Waiting for the cube's state means a cube that already
  // happens to match doesn't make the solver "apply" a scramble that's already there.
  useEffect(() => {
    if (!scramble) return;
    let target: string;
    try {
      target = scrambledFacelets(scramble);
    } catch (error) {
      console.error("[smartcube] couldn't interpret scramble", scramble, error);
      return;
    }
    dispatch({ type: "scramble", scramble, target, facelets: cube.facelets });
    // Only on a new scramble: re-running this when the cube turns would reset mid-scramble.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scramble, dispatch]);

  // Cube turns.
  useEffect(
    () =>
      subscribeMoves((move, after, event) =>
        dispatch({ type: "move", move, cubeTs: event.cubeTs, localTs: event.localTs, after })
      ),
    [dispatch]
  );

  // Full-state snapshots, used only to notice that a move was missed mid-solve.
  useEffect(
    () =>
      subscribeEvents((event) => {
        if (event.type === "facelets") {
          dispatch({ type: "facelets", facelets: event.facelets, localTs: event.localTs });
        }
      }),
    [dispatch]
  );

  // Inspection countdown and the running timer. Both are display-only — the recorded time comes
  // from the cube's timestamps, never from these.
  const phase = solve.phase;
  const inspectionStartedAt = solve.inspectionStartedAt;
  useEffect(() => {
    if (phase !== "inspecting" || inspectionStartedAt === null) {
      // Cleared on the next tick rather than synchronously: a setState in an effect body
      // cascades a render, and this is only a display value.
      const id = setTimeout(() => setInspectionMs(0), 0);
      return () => clearTimeout(id);
    }
    const id = setInterval(() => {
      const now = performance.now();
      setInspectionMs(now - inspectionStartedAt);
      dispatch({ type: "tick", now });
    }, INSPECTION_TICK_MS);
    return () => clearInterval(id);
  }, [phase, inspectionStartedAt, dispatch]);

  useEffect(() => {
    if (phase !== "solving") {
      const id = setTimeout(() => setLiveMs(0), 0);
      return () => clearTimeout(id);
    }
    const started = performance.now();
    const id = setInterval(() => setLiveMs(performance.now() - started), 30);
    return () => clearInterval(id);
  }, [phase]);

  // Finished: analyse once, record, and leave the result on screen until the next scramble.
  const recordedFor = useRef<SolveState | null>(null);
  useEffect(() => {
    if (solve.phase !== "solved" || recordedFor.current === solve) return;
    recordedFor.current = solve;

    const analysis = analyseSolve(solve.target ?? "", solve.moves);
    const completed: CompletedSolve = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      scramble: solve.scramble ?? "",
      scrambledState: solve.target ?? "",
      timeCs: solveTimeCs(solve),
      penalty: solve.penalty,
      moves: solve.moves,
      analysis:
        solve.resynced && analysis.method === "cfop"
          ? {
              ...analysis,
              confidence: "low",
              reason: "A turn was missed over Bluetooth, so the step splits may be off.",
            }
          : analysis,
      timingSource: solve.timingSource,
      resynced: solve.resynced,
      solvedAt: new Date().toISOString(),
    };
    history = [completed, ...history];
    emitHistory();
  }, [solve]);

  const startInspection = useCallback(
    () => dispatch({ type: "startInspection", now: performance.now() }),
    [dispatch]
  );
  const setPenalty = useCallback(
    (penalty: SolveState["penalty"]) => dispatch({ type: "penalty", penalty }),
    [dispatch]
  );

  return {
    solve,
    scramble,
    solves,
    latest: solves[0] ?? null,
    inspectionMs,
    liveMs,
    connected: cube.status === "connected",
    startInspection,
    setPenalty,
    nextScramble,
    clearHistory,
  };
}
