"use client";

import { recordSolve } from "@/app/actions/solve";
import {
  getPendingSolves,
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

  const pending = await getPendingSolves();
  if (!pending.length) return { synced: 0, failed: 0, errors: [] };

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const solve of pending) {
    try {
      await flushOne(solve);
      await removePendingSolve(solve.id);
      synced++;
    } catch (e) {
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
    ...(solve.cubeId && { cubeId: solve.cubeId }),
  });
  if (result.error) throw new Error(result.error);
}
