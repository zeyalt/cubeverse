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
  await recordSolve({
    cuberId: solve.cuberId,
    eventId: solve.eventId,
    timeCs: solve.timeCs,
    penalty: solve.penalty,
    scramble: solve.scramble,
  });
}
