"use client";

/**
 * The session's finished solves, and their journey to Supabase.
 *
 * Module-level rather than component state for the same reason the connection is: switching tabs
 * unmounts the Smart tab, and losing the session's history to a tab switch would be absurd.
 *
 * Saving is offline-first. Every solve goes into the IndexedDB outbox and is then flushed, rather
 * than being posted directly with the queue as a fallback — a cube works perfectly well on a train,
 * and the two-path version is the one where the fallback is never exercised and quietly broken.
 * The list the UI shows is therefore local-first too: what the server returned, with anything still
 * queued merged on top, so a solve never vanishes from the screen while it waits to sync.
 */

import { listSmartSolves, type SmartSolveInput, type StoredSmartSolve } from "@/lib/client/smartSolves";
import { deleteSmartSolve, updateSmartSolvePenalty } from "@/lib/client/smartSolves";
import { enqueueSmartSolve, getQueuedSmartSolves } from "@/lib/offline/smartSolveQueue";
import { syncNow } from "@/lib/offline/syncStore";
import { decodeMoveStream, encodeMoveStream, MOVE_STREAM_VERSION, type TimedMove } from "./moveStream";
import type { SolveAnalysis } from "./analysis";

export interface SmartSolveRecord {
  /** Server row id once saved; the idempotency key until then. */
  id: string;
  eventId: string;
  timeCs: number | null;
  penalty: "none" | "plus2" | "dnf";
  scramble: string | null;
  moves: TimedMove[];
  analysis: SolveAnalysis | null;
  timingSource: "cube" | "local";
  confidence: "high" | "low";
  cubeName: string | null;
  solvedAt: string;
  /** Still in the outbox — shown to the user rather than implied to be saved. */
  pending: boolean;
}

export interface SolveStoreState {
  solves: SmartSolveRecord[];
  loading: boolean;
  /** Set when the server list couldn't be read; the session still works, locally. */
  error: string | null;
}

const EMPTY: SolveStoreState = { solves: [], loading: false, error: null };

let state: SolveStoreState = EMPTY;
let key: string | null = null;

const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of [...listeners]) listener();
};
const set = (next: Partial<SolveStoreState>) => {
  state = { ...state, ...next };
  emit();
};

export const subscribeSolves = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getSolvesSnapshot = () => state;
export const getServerSnapshot = () => EMPTY;

const byNewest = (a: SmartSolveRecord, b: SmartSolveRecord) => b.solvedAt.localeCompare(a.solvedAt);

const fromStored = (row: StoredSmartSolve): SmartSolveRecord => ({
  id: row.id,
  eventId: row.eventId,
  timeCs: row.penalty === "dnf" ? null : row.timeCs,
  penalty: row.penalty,
  scramble: row.scramble,
  // A stream that won't decode costs the replay, not the solve: the time and the analysis are
  // stored separately and stay readable.
  moves: (row.moveStream && decodeMoveStream(row.moveStream)) || [],
  analysis: row.reconstruction,
  timingSource: row.timingSource,
  confidence: row.confidence,
  cubeName: row.cubeName,
  solvedAt: row.solvedAt,
  pending: false,
});

const fromQueued = (payload: SmartSolveInput): SmartSolveRecord => ({
  id: payload.idempotencyId,
  eventId: payload.eventId,
  timeCs: payload.penalty === "dnf" ? null : payload.timeCs,
  penalty: payload.penalty,
  scramble: payload.scramble,
  moves: (payload.moveStream && decodeMoveStream(payload.moveStream)) || [],
  analysis: payload.reconstruction,
  timingSource: payload.timingSource,
  confidence: payload.confidence,
  cubeName: payload.cubeName,
  solvedAt: payload.solvedAt,
  pending: true,
});

/**
 * Load this cuber and event's solves.
 *
 * Queued solves are merged in by `solvedAt`, deduped against the server's rows — a solve that has
 * just synced exists in both places, and showing it twice would corrupt every average on screen.
 */
export async function loadSolves(cuberId: string, eventId: string): Promise<void> {
  const next = `${cuberId}:${eventId}`;
  if (key === next && (state.solves.length > 0 || state.loading)) return;
  key = next;
  set({ loading: true, error: null, solves: [] });

  const queued = await getQueuedSmartSolves()
    .then((rows) =>
      rows.filter((r) => r.payload.cuberId === cuberId && r.payload.eventId === eventId)
    )
    .catch(() => []);

  try {
    const stored = await listSmartSolves(cuberId, eventId);
    const storedAt = new Set(stored.map((row) => row.solvedAt));
    set({
      loading: false,
      solves: [
        ...stored.map(fromStored),
        ...queued.filter((q) => !storedAt.has(q.payload.solvedAt)).map((q) => fromQueued(q.payload)),
      ].sort(byNewest),
    });
  } catch (cause) {
    // Offline, or signed out. The queue is all we have, and it's enough to keep timing.
    set({
      loading: false,
      solves: queued.map((q) => fromQueued(q.payload)).sort(byNewest),
      error: cause instanceof Error ? cause.message : "Couldn't load earlier solves",
    });
  }
}

/** Queue a finished solve and show it immediately. */
export async function saveSolve(
  input: Omit<SmartSolveInput, "moveStream" | "moveStreamVersion" | "idempotencyId"> & {
    moves: TimedMove[];
  }
): Promise<void> {
  const { moves, ...rest } = input;
  let moveStream: string | null = null;
  try {
    moveStream = encodeMoveStream(moves);
  } catch {
    // An unencodable move (a rotation, a slice move from some future cube) must not cost the
    // solve. The time and the analysis are stored regardless; only the replay is lost.
    moveStream = null;
  }

  const payload: SmartSolveInput = {
    ...rest,
    moveStream,
    moveStreamVersion: MOVE_STREAM_VERSION,
    idempotencyId: crypto.randomUUID(),
  };

  set({ solves: [fromQueued(payload), ...state.solves].sort(byNewest) });
  await enqueueSmartSolve(payload);
  void syncNow();
}

/** Apply a +2 or DNF after the fact. Optimistic, then reconciled. */
export async function setSolvePenalty(
  id: string,
  penalty: "none" | "plus2" | "dnf"
): Promise<void> {
  const target = state.solves.find((s) => s.id === id);
  if (!target) return;
  set({
    solves: state.solves.map((s) =>
      s.id === id ? { ...s, penalty, timeCs: penalty === "dnf" ? null : s.timeCs } : s
    ),
  });
  // A still-queued solve has no server row yet; its payload carries the penalty it was saved with,
  // so editing one before it syncs isn't supported and the UI doesn't offer it.
  if (target.pending) return;
  try {
    await updateSmartSolvePenalty(id, penalty);
  } catch {
    set({ solves: state.solves.map((s) => (s.id === id ? target : s)) });
  }
}

export async function removeSolve(id: string): Promise<void> {
  const target = state.solves.find((s) => s.id === id);
  if (!target) return;
  set({ solves: state.solves.filter((s) => s.id !== id) });
  if (target.pending) return;
  try {
    await deleteSmartSolve(id);
  } catch {
    set({ solves: [...state.solves, target].sort(byNewest) });
  }
}

/** Test seam, and used when switching cuber. */
export function resetSolveStore(): void {
  key = null;
  state = EMPTY;
  emit();
}
