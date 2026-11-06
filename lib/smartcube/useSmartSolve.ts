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
import {
  getServerSnapshot,
  getSolvesSnapshot,
  loadSolves,
  removeSolve,
  saveSolve,
  setSolvePenalty,
  subscribeSolves,
} from "./solveStore";

/**
 * Drives one solve: hand out a scramble, watch the cube reach it, run inspection, time the solve
 * from the cube's own clock, and analyse it the moment it's solved.
 *
 * The state machine itself is pure (`solveMachine.ts`); this only feeds it real events and owns
 * the timers React needs.
 */

/**
 * Finished solves live in `solveStore.ts`, which owns both the session list and its trip to
 * Supabase. This hook only produces them.
 */
export type { SmartSolveRecord } from "./solveStore";

const INSPECTION_TICK_MS = 100;

export function useSmartSolve(cuberId: string, eventId = "333") {
  const cube = useSmartCube();
  const { scramble, next: nextScramble } = useScramble(eventId);
  const [solve, setSolve] = useState<SolveState>(INITIAL_SOLVE);
  const [inspectionMs, setInspectionMs] = useState(0);
  const [liveMs, setLiveMs] = useState(0);

  const store = useSyncExternalStore(subscribeSolves, getSolvesSnapshot, getServerSnapshot);
  const solves = store.solves;

  // Earlier solves for this cuber and event, from Supabase plus anything still queued offline.
  useEffect(() => {
    void loadSolves(cuberId, eventId);
  }, [cuberId, eventId]);

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

  // Finished: analyse once, save, and leave the result on screen until the next scramble.
  const recordedFor = useRef<SolveState | null>(null);
  useEffect(() => {
    if (solve.phase !== "solved" || recordedFor.current === solve) return;
    recordedFor.current = solve;

    const raw = analyseSolve(solve.target ?? "", solve.moves);
    // Drift lowers confidence; it never discards the solve. The reason travels with the record so
    // the UI can say why rather than showing a bare badge.
    const analysis: SolveAnalysis =
      solve.resynced && raw.method === "cfop"
        ? {
            ...raw,
            confidence: "low",
            reason: "A turn was missed over Bluetooth, so the step splits may be off.",
          }
        : raw;

    void saveSolve({
      cuberId,
      eventId,
      timeCs: solveTimeCs(solve) ?? 0,
      penalty: solve.penalty,
      scramble: solve.scramble,
      moves: solve.moves,
      // Stored even when the method wasn't recognised: the totals (time, turns, TPS, fluency) are
      // in there and are worth keeping. Only the step breakdown is absent, and it says so.
      reconstruction: analysis,
      timingSource: solve.timingSource,
      confidence: solve.resynced ? "low" : "high",
      cubeName: cube.name,
      solvedAt: new Date().toISOString(),
    });
    // cube.name is read, not depended on: it can't change between the solve and this effect, and
    // depending on it would re-save the solve on a battery update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solve, cuberId, eventId]);

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
    loading: store.loading,
    loadError: store.error,
    inspectionMs,
    liveMs,
    connected: cube.status === "connected",
    startInspection,
    setPenalty,
    nextScramble,
    /** Penalty on an already-saved solve, as opposed to the one in progress. */
    setSolvePenalty,
    removeSolve,
  };
}
