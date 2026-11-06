"use client";

import { recordSolve } from "@/lib/client/actions";
import { recordSmartSolve } from "@/lib/client/smartSolves";
import {
  claimQueuedSmartSolve,
  getQueuedSmartSolves,
  markQueuedSmartSolveFailed,
  removeQueuedSmartSolve,
} from "./smartSolveQueue";
import {
  claimPendingSolve,
  getPendingSolves,
  markPendingSolveFailed,
  removePendingSolve,
  type PendingSolve,
} from "./queue";

export type SyncResult = {
  synced: number;
  failed: number;
  errors: string[];
};

/** Flush all queued offline solves to the server. */
export async function syncPendingSolves(): Promise<SyncResult> {
  if (!navigator.onLine) {
    return { synced: 0, failed: 0, errors: [] };
  }

  const pending = await getPendingSolves({ dueOnly: true });
  if (!pending.length) return { synced: 0, failed: 0, errors: [] };

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const solve of pending) {
    const claimed = await claimPendingSolve(solve.id);
    if (!claimed) continue;
    try {
      await flushOne(claimed);
      await removePendingSolve(claimed.id);
      synced++;
    } catch (e) {
      await markPendingSolveFailed(claimed.id, e);
      failed++;
      errors.push((e as Error).message);
    }
  }

  return { synced, failed, errors };
}

/**
 * Flush queued smart-cube solves.
 *
 * Separate from `syncPendingSolves` for the same reason the table is separate: these go to
 * `smart_solves` and must never be handed to `record_practice_solve`. The queued payload is
 * passed to the action **whole** rather than rebuilt field by field — see the note at the top of
 * `smartSolveQueue.ts` for why that matters here.
 */
export async function syncQueuedSmartSolves(): Promise<SyncResult> {
  if (!navigator.onLine) return { synced: 0, failed: 0, errors: [] };

  const pending = await getQueuedSmartSolves({ dueOnly: true });
  if (!pending.length) return { synced: 0, failed: 0, errors: [] };

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const queued of pending) {
    const claimed = await claimQueuedSmartSolve(queued.id);
    if (!claimed) continue;
    try {
      // Resolving does not imply success — recordSmartSolve returns its error rather than
      // throwing, exactly as recordSolve does. Without this check a solve rejected for a real
      // reason would be dropped from the queue and lost.
      const result = await recordSmartSolve(claimed.payload);
      if (result.error) throw new Error(result.error);
      await removeQueuedSmartSolve(claimed.id);
      synced++;
    } catch (e) {
      await markQueuedSmartSolveFailed(claimed.id, e);
      failed++;
      errors.push((e as Error).message);
    }
  }

  return { synced, failed, errors };
}

async function flushOne(solve: PendingSolve): Promise<void> {
  // recordSolve never rejects — it catches its own errors and resolves with
  // { error: "..." } instead (so the *first* save attempt, in KidPracticeTab,
  // can show why a solve failed rather than have Next redact a thrown error).
  // That means a resolved promise here does NOT imply success: without this
  // check, a solve that fails for a real reason (bad cubeId, RLS denial, a
  // constraint violation — anything other than "network unreachable") would
  // be treated as synced, deleted from the queue, and lost for good.
  const result = await recordSolve({
    cuberId: solve.cuberId,
    eventId: solve.eventId,
    timeCs: solve.timeCs,
    penalty: solve.penalty,
    scramble: solve.scramble,
    idempotencyId: solve.idempotencyId,
    ...(solve.cubeId && { cubeId: solve.cubeId }),
  });
  if (result.error) throw new Error(result.error);
}
