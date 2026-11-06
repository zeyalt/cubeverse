"use client";

/**
 * The solver's goal time, per cuber, for the Insights goal splits.
 *
 * Kept in localStorage: it is a preference about this device's view, not a record of anything, and
 * losing it costs one tap to set again. Every access is guarded — private windows and blocked
 * storage throw — and a missing value means "suggest one", never an error.
 */

import { useSyncExternalStore } from "react";

const key = (cuberId: string) => `cubeverse.smartcube.goal.${cuberId}`;
const listeners = new Set<() => void>();

function read(cuberId: string): number | null {
  try {
    const raw = window.localStorage.getItem(key(cuberId));
    const ms = raw === null ? NaN : Number(raw);
    return Number.isFinite(ms) && ms > 0 ? ms : null;
  } catch {
    return null;
  }
}

export function setGoalMs(cuberId: string, ms: number | null): void {
  try {
    if (ms === null) window.localStorage.removeItem(key(cuberId));
    else window.localStorage.setItem(key(cuberId), String(Math.round(ms)));
  } catch {
    // Unsaveable storage just means the goal lasts for this visit.
  }
  for (const listener of [...listeners]) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The stored goal in ms, or null when the solver hasn't chosen one. */
export function useGoalMs(cuberId: string): number | null {
  return useSyncExternalStore(
    subscribe,
    () => read(cuberId),
    () => null
  );
}
