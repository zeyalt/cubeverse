/**
 * Offline queue for smart-cube solves, on the same IndexedDB outbox as practice solves but under
 * its own `entityType` so the two never flush through each other's code path.
 *
 * **Why this doesn't re-list the payload's fields.** The practice-solve queue spells out its
 * payload in three places — the interface, the enqueue function, and the explicit argument object
 * in `sync.ts` — and a field added to the first two but missed in the third is silently dropped on
 * sync, with no error anywhere. A smart solve carries a move stream and a reconstruction, so a
 * drop like that would lose the replay and the analysis while appearing to succeed. The payload is
 * therefore stored and replayed as one opaque object: there is exactly one list of fields
 * (`SmartSolveInput`), and nothing in this file or the flusher can omit one. `smartSolveQueue.test.ts`
 * holds that line by comparing the round trip key for key.
 */

import {
  claimMutation,
  enqueueMutation,
  listMutations,
  markMutationFailed,
  removeMutation,
} from "./outbox";
import type { SmartSolveInput } from "@/lib/client/smartSolves";

export const SMART_SOLVE_ENTITY = "smartSolve";

export interface QueuedSmartSolve {
  /** Outbox row id, not the solve's id. */
  id: string;
  payload: SmartSolveInput;
  attempts?: number;
  nextAttemptAt?: number;
  lastError?: string;
}

export async function enqueueSmartSolve(payload: SmartSolveInput): Promise<void> {
  await enqueueMutation<SmartSolveInput>({
    scope: `cuber:${payload.cuberId}`,
    entityType: SMART_SOLVE_ENTITY,
    operation: "create",
    // Passed through whole, never field by field. See the note at the top of this file.
    payload,
    createdAt: payload.solvedAt,
    idempotencyKey: payload.idempotencyId,
  });
}

export async function getQueuedSmartSolves(
  options: { dueOnly?: boolean } = {}
): Promise<QueuedSmartSolve[]> {
  const mutations = await listMutations<SmartSolveInput>({
    entityType: SMART_SOLVE_ENTITY,
    dueOnly: options.dueOnly,
  });
  return mutations
    .map((mutation) => ({
      id: mutation.id,
      payload: mutation.payload,
      attempts: mutation.attempts,
      nextAttemptAt: mutation.nextAttemptAt,
      lastError: mutation.lastError,
    }))
    .sort(
      (a, b) =>
        new Date(a.payload.solvedAt).getTime() - new Date(b.payload.solvedAt).getTime()
    );
}

export async function claimQueuedSmartSolve(id: string): Promise<QueuedSmartSolve | null> {
  const mutation = await claimMutation<SmartSolveInput>(id);
  if (!mutation || mutation.entityType !== SMART_SOLVE_ENTITY) return null;
  return {
    id: mutation.id,
    payload: mutation.payload,
    attempts: mutation.attempts,
    nextAttemptAt: mutation.nextAttemptAt,
    lastError: mutation.lastError,
  };
}

export const removeQueuedSmartSolve = (id: string) => removeMutation(id);
export const markQueuedSmartSolveFailed = (id: string, error: unknown) =>
  markMutationFailed(id, error);
