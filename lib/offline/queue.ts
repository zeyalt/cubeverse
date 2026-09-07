import {
  claimMutation,
  enqueueMutation,
  listMutations,
  markMutationFailed,
  removeMutation,
} from "./outbox";

export interface PendingSolve {
  id: string;
  cuberId: string;
  eventId: string;
  timeCs: number;
  penalty: "none" | "plus2" | "dnf";
  scramble: string | null;
  solvedAt: string;
  cubeId?: string;
  idempotencyId?: string;
  attempts?: number;
  nextAttemptAt?: number;
  lastAttemptAt?: string;
  lastError?: string;
}

type SolvePayload = Omit<
  PendingSolve,
  | "id"
  | "idempotencyId"
  | "attempts"
  | "nextAttemptAt"
  | "lastAttemptAt"
  | "lastError"
>;

export async function enqueueSolve(
  solve: Omit<PendingSolve, "id" | "solvedAt"> & { solvedAt?: string }
): Promise<void> {
  const solvedAt = solve.solvedAt ?? new Date().toISOString();
  const payload: SolvePayload = {
    cuberId: solve.cuberId,
    eventId: solve.eventId,
    timeCs: solve.timeCs,
    penalty: solve.penalty,
    scramble: solve.scramble,
    solvedAt,
    ...(solve.cubeId && { cubeId: solve.cubeId }),
  };
  await enqueueMutation({
    scope: `cuber:${solve.cuberId}`,
    entityType: "solve",
    operation: "create",
    payload,
    createdAt: solvedAt,
    idempotencyKey: solve.idempotencyId,
  });
}

export async function getPendingSolves(
  options: { dueOnly?: boolean } = {}
): Promise<PendingSolve[]> {
  const mutations = await listMutations<SolvePayload>({
    entityType: "solve",
    dueOnly: options.dueOnly,
  });
  return mutations
    .map((mutation) => ({
      ...mutation.payload,
      id: mutation.id,
      idempotencyId: mutation.idempotencyKey,
      attempts: mutation.attempts,
      nextAttemptAt: mutation.nextAttemptAt,
      lastAttemptAt: mutation.lastAttemptAt,
      lastError: mutation.lastError,
    }))
    .sort(
      (a, b) => new Date(a.solvedAt).getTime() - new Date(b.solvedAt).getTime()
    );
}

export async function getPendingCount(): Promise<number> {
  return (await listMutations({ entityType: "solve" })).length;
}

export async function removePendingSolve(id: string): Promise<void> {
  await removeMutation(id);
}

export async function claimPendingSolve(id: string): Promise<PendingSolve | null> {
  const mutation = await claimMutation(id);
  if (!mutation || mutation.entityType !== "solve") return null;
  return {
    ...(mutation.payload as SolvePayload),
    id: mutation.id,
    idempotencyId: mutation.idempotencyKey,
    attempts: mutation.attempts,
    nextAttemptAt: mutation.nextAttemptAt,
    lastAttemptAt: mutation.lastAttemptAt,
    lastError: mutation.lastError,
  };
}

export async function markPendingSolveFailed(id: string, error: unknown): Promise<void> {
  await markMutationFailed(id, error);
}
