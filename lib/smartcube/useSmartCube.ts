"use client";

import { useSyncExternalStore } from "react";
import { SOLVED, applyMove, isSolved } from "./facelets";
import { SNAPSHOT_QUIET_MS } from "./solveMachine";
import type { CubeEvent, CubeHardwareInfo, SmartCube } from "./drivers/types";

/**
 * Single owner of the smart-cube connection.
 *
 * Deliberately a module-level store rather than component state: unmounting the Smart tab (which
 * happens on every tab switch) would otherwise tear down the GATT connection, and reconnecting
 * means another browser permission dialog. Only the 3D view is disposed on unmount; the cube stays
 * connected underneath.
 *
 * Same shape as `lib/offline/syncStore.ts` — one owner, `useSyncExternalStore` for readers.
 */

/**
 * A cube snapshot that disagrees with our model is only trusted once turning has paused. Shared with
 * the solve machine, which uses the same rule to decide whether a solve lost a move.
 */
const RESYNC_QUIET_MS = SNAPSHOT_QUIET_MS;

export type SmartCubeStatus = "disconnected" | "connecting" | "connected";

export interface SmartCubeState {
  status: SmartCubeStatus;
  /** Null unless the last connection attempt failed. */
  error: string | null;
  brand: string | null;
  name: string | null;
  battery: number | null;
  hardware: CubeHardwareInfo | null;
  /** The app's belief about the cube's state, as a 54-char facelet string. */
  facelets: string;
  /** True once the cube has told us its state at least once. */
  haveCubeState: boolean;
  /**
   * The cube reported a scrambled state on connect. Its internal model drifts when it's turned
   * while disconnected, so this usually means "press Mark as solved", not "your cube is scrambled".
   */
  needsSync: boolean;
  moveCount: number;
  lastMove: string | null;
}

const INITIAL: SmartCubeState = {
  status: "disconnected",
  error: null,
  brand: null,
  name: null,
  battery: null,
  hardware: null,
  facelets: SOLVED,
  haveCubeState: false,
  needsSync: false,
  moveCount: 0,
  lastMove: null,
};

let state: SmartCubeState = INITIAL;
let cube: SmartCube | null = null;
let unsubscribeCube: (() => void) | null = null;
let lastMoveAt = 0;
let batteryPoll: ReturnType<typeof setInterval> | null = null;

const BATTERY_POLL_MS = 60_000;

const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of [...listeners]) listener();
};

function setState(next: Partial<SmartCubeState>) {
  // Replaced rather than mutated: useSyncExternalStore compares snapshots by identity.
  state = { ...state, ...next };
  emit();
}

/**
 * Moves are delivered on their own channel, not through React state. A fast solver produces ~10
 * moves a second and the 3D view needs each one individually; routing that through a re-render
 * would be both wasteful and lossy.
 */
export type MoveListener = (move: string, after: string, event: Extract<CubeEvent, { type: "move" }>) => void;
const moveListeners = new Set<MoveListener>();

export function subscribeMoves(listener: MoveListener): () => void {
  moveListeners.add(listener);
  return () => {
    moveListeners.delete(listener);
  };
}

/** Raw event feed, for the solve state machine and the diagnostic log. */
const eventListeners = new Set<(event: CubeEvent) => void>();

export function subscribeEvents(listener: (event: CubeEvent) => void): () => void {
  eventListeners.add(listener);
  return () => {
    eventListeners.delete(listener);
  };
}

function handleEvent(event: CubeEvent) {
  switch (event.type) {
    case "move": {
      const after = applyMove(state.facelets, event.move);
      lastMoveAt = event.localTs;
      setState({
        facelets: after,
        moveCount: state.moveCount + 1,
        lastMove: event.move,
        needsSync: state.needsSync && !isSolved(after),
      });
      for (const listener of [...moveListeners]) listener(event.move, after, event);
      break;
    }
    case "facelets": {
      if (!state.haveCubeState) {
        setState({
          facelets: event.facelets,
          haveCubeState: true,
          needsSync: !isSolved(event.facelets),
        });
      } else if (event.facelets !== state.facelets && event.localTs - lastMoveAt > RESYNC_QUIET_MS) {
        // The cube is authoritative once turning has settled — a missed BLE packet would
        // otherwise leave the app's model permanently wrong.
        setState({ facelets: event.facelets, needsSync: !isSolved(event.facelets) });
      } else if (isSolved(event.facelets)) {
        setState({ needsSync: false });
      }
      break;
    }
    case "battery":
      setState({ battery: event.level });
      break;
    case "hardware":
      setState({ hardware: event.info });
      break;
    case "disconnect":
      teardown();
      break;
    case "gyro":
      break;
  }
  for (const listener of [...eventListeners]) listener(event);
}

function teardown() {
  if (batteryPoll) clearInterval(batteryPoll);
  batteryPoll = null;
  unsubscribeCube?.();
  unsubscribeCube = null;
  cube = null;
  state = { ...INITIAL };
  emit();
}

export type ConnectOptions = {
  /** Called when the cube's MAC is needed and we don't already know it. */
  askMac: (device: Pick<BluetoothDevice, "id" | "name">) => Promise<string | null>;
};

export async function connect({ askMac }: ConnectOptions): Promise<boolean> {
  if (state.status !== "disconnected") return state.status === "connected";
  setState({ status: "connecting", error: null });
  try {
    // Imported here, not at module scope: this is what keeps three.js and the BLE stack out of
    // every other page's bundle.
    const { connectSmartCube } = await import("./drivers");
    const connected = await connectSmartCube({ askMac });
    cube = connected;
    unsubscribeCube = connected.on(handleEvent);
    setState({
      status: "connected",
      brand: connected.brand,
      name: connected.name,
      error: null,
      facelets: SOLVED,
      haveCubeState: false,
      moveCount: 0,
      lastMove: null,
    });
    if (typeof window !== "undefined") window.addEventListener("beforeunload", disconnectSync);
    // A cube can be on for an hour; one reading at connect time goes stale. Cheap to refresh.
    batteryPoll = setInterval(() => void cube?.requestBattery().catch(() => {}), BATTERY_POLL_MS);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Dismissing the browser's device chooser is a normal thing to do, not an error to report.
    const cancelled = /cancel/i.test(message) || /user denied/i.test(message);
    setState({ status: "disconnected", error: cancelled ? null : message });
    return false;
  }
}

export async function disconnect(): Promise<void> {
  const current = cube;
  teardown();
  await current?.disconnect().catch(() => {});
}

const disconnectSync = () => {
  void cube?.disconnect().catch(() => {});
};

export async function markSolved(): Promise<void> {
  if (!cube) return;
  await cube.markSolved();
  setState({ facelets: SOLVED, needsSync: false });
}

export async function requestState(): Promise<void> {
  // Accept the next snapshot unconditionally, bypassing the quiet-period rule.
  lastMoveAt = 0;
  await cube?.requestState();
}

/** Replace the model, e.g. after the user confirms the cube is in a known state. */
export function setFacelets(facelets: string): void {
  setState({ facelets, needsSync: !isSolved(facelets) });
}

export function resetMoveCount(): void {
  setState({ moveCount: 0, lastMove: null });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => state;

export function useSmartCube(): SmartCubeState {
  return useSyncExternalStore(subscribe, getSnapshot, () => INITIAL);
}
