import {
  LEGACY_SOLVE_STORE,
  OUTBOX_STORE,
  openOfflineDb,
  requestResult,
  transactionDone,
} from "./db";
import {
  createPendingMutation,
  errorMessage,
  retryDelayMs,
  type NewMutation,
  type PendingMutation,
} from "./model";

export interface MutationQuery {
  scope?: string;
  entityType?: string;
  dueOnly?: boolean;
  now?: number;
  limit?: number;
}

export async function enqueueMutation<T>(input: NewMutation<T>): Promise<PendingMutation<T>> {
  const db = await openOfflineDb();
  const transaction = db.transaction(OUTBOX_STORE, "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore(OUTBOX_STORE);
  const row = createPendingMutation(input);
  const existing = await requestResult(
    store.index("by-idempotency").get(row.idempotencyKey)
  ) as PendingMutation<T> | undefined;

  if (existing) {
    transaction.abort();
    try {
      await done;
    } catch {
      // Aborting a read-only path prevents an unnecessary write and is expected.
    }
    return existing;
  }

  await requestResult(store.add(row));
  await done;
  return row;
}

export async function listMutations<T = unknown>(
  query: MutationQuery = {}
): Promise<PendingMutation<T>[]> {
  const db = await openOfflineDb();
  const transaction = db.transaction(OUTBOX_STORE, "readonly");
  const done = transactionDone(transaction);
  const rows = await requestResult<PendingMutation<T>[]>(
    transaction.objectStore(OUTBOX_STORE).getAll()
  );
  await done;

  const now = query.now ?? Date.now();
  return rows
    .filter((row) => !query.scope || row.scope === query.scope)
    .filter((row) => !query.entityType || row.entityType === query.entityType)
    .filter(
      (row) =>
        !query.dueOnly ||
        (row.nextAttemptAt <= now &&
          (row.status === "pending" || (row.leaseUntil ?? 0) <= now))
    )
    .sort((a, b) => a.nextAttemptAt - b.nextAttemptAt || a.createdAt.localeCompare(b.createdAt))
    .slice(0, query.limit ?? Number.POSITIVE_INFINITY);
}

export async function claimMutation(
  id: string,
  now = Date.now(),
  leaseMs = 60_000
): Promise<PendingMutation | null> {
  const db = await openOfflineDb();
  const transaction = db.transaction(OUTBOX_STORE, "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore(OUTBOX_STORE);
  const row = (await requestResult(store.get(id))) as PendingMutation | undefined;

  if (
    !row ||
    row.nextAttemptAt > now ||
    (row.status === "in-flight" && (row.leaseUntil ?? 0) > now)
  ) {
    transaction.abort();
    try {
      await done;
    } catch {
      // Expected when there is nothing eligible to claim.
    }
    return null;
  }

  const claimed: PendingMutation = {
    ...row,
    status: "in-flight",
    attempts: row.attempts + 1,
    lastAttemptAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    leaseUntil: now + leaseMs,
  };
  await requestResult(store.put(claimed));
  await done;
  return claimed;
}

export async function markMutationFailed(
  id: string,
  error: unknown,
  now = Date.now(),
  random = Math.random()
): Promise<void> {
  const db = await openOfflineDb();
  const transaction = db.transaction(OUTBOX_STORE, "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore(OUTBOX_STORE);
  const row = (await requestResult(store.get(id))) as PendingMutation | undefined;

  if (row) {
    const attempts = Math.max(1, row.attempts);
    await requestResult(
      store.put({
        ...row,
        status: "pending",
        leaseUntil: undefined,
        lastError: errorMessage(error),
        nextAttemptAt: now + retryDelayMs(attempts, random),
        updatedAt: new Date(now).toISOString(),
      })
    );
  }
  await done;
}

export async function removeMutation(id: string): Promise<void> {
  const db = await openOfflineDb();
  const stores = db.objectStoreNames.contains(LEGACY_SOLVE_STORE)
    ? [OUTBOX_STORE, LEGACY_SOLVE_STORE]
    : [OUTBOX_STORE];
  const transaction = db.transaction(stores, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(OUTBOX_STORE).delete(id);
  if (stores.includes(LEGACY_SOLVE_STORE)) {
    transaction.objectStore(LEGACY_SOLVE_STORE).delete(id);
  }
  await done;
}
