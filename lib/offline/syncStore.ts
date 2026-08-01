"use client";

import { useSyncExternalStore } from "react";
import { getPendingCount } from "./queue";
import { syncPendingSolves } from "./sync";

/**
 * Single owner of the offline-solve flush loop.
 *
 * This used to be duplicated per consumer — each with its own mount fetch,
 * "online" listener, interval and in-flight guard, at different poll periods.
 * Centralising it means one flush loop no matter how many components observe
 * it, and one IndexedDB read per poll rather than one per component.
 *
 * The listener and interval here start with the first subscriber and stop with
 * the last, so nothing runs when no component is watching.
 */

const POLL_MS = 30_000;

interface SyncState {
  pending: number;
  syncing: boolean;
}

let state: SyncState = { pending: 0, syncing: false };
const listeners = new Set<() => void>();

let inFlight: Promise<void> | null = null;
let poll: ReturnType<typeof setInterval> | null = null;

function emit() {
  for (const l of listeners) l();
}

function setState(next: Partial<SyncState>) {
  const merged = { ...state, ...next };
  if (merged.pending === state.pending && merged.syncing === state.syncing) return;
  // Replaced rather than mutated: useSyncExternalStore compares snapshots by
  // identity, so an in-place update would not re-render.
  state = merged;
  emit();
}

async function refreshCount() {
  try {
    setState({ pending: await getPendingCount() });
  } catch {
    // An unreadable queue shouldn't take the UI down; the next poll retries.
  }
}

/** Flush the queue. Concurrent calls share the one in-flight run. */
export function syncNow(): Promise<void> {
  if (inFlight) return inFlight;
  if (typeof navigator !== "undefined" && !navigator.onLine) return Promise.resolve();

  setState({ syncing: true });
  inFlight = syncPendingSolves()
    .then((result) => {
      if (result.failed > 0) {
        // Still queued — the next poll or "online" event retries. Logged so a
        // permanently-failing item is diagnosable rather than silently looping.
        console.error("[offline-sync] solves still pending:", result.errors);
      }
    })
    .catch((err) => {
      console.error("[offline-sync] flush failed:", err);
    })
    .finally(async () => {
      inFlight = null;
      setState({ syncing: false });
      await refreshCount();
    });

  return inFlight;
}

/** Re-read the queue length — call after enqueueing so the badge is immediate. */
export function bumpPendingCount() {
  void refreshCount();
}

function onOnline() {
  void syncNow();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (listeners.size === 1) {
    window.addEventListener("online", onOnline);
    poll = setInterval(() => void syncNow(), POLL_MS);
    void refreshCount();
    void syncNow();
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("online", onOnline);
      if (poll) clearInterval(poll);
      poll = null;
    }
  };
}

const getSnapshot = () => state;
// The server has no queue; a stable object keeps hydration quiet.
const serverSnapshot: SyncState = { pending: 0, syncing: false };
const getServerSnapshot = () => serverSnapshot;

export function useOfflineSync(): SyncState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
