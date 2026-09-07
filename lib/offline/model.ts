export type MutationOperation = "create" | "update" | "delete" | string;
export type MutationStatus = "pending" | "in-flight";

export interface EntityCacheRecord<T = unknown> {
  key: string;
  scope: string;
  entityType: string;
  entityId: string;
  value: T | null;
  tombstone: boolean;
  updatedAt: string;
  serverUpdatedAt?: string;
  cursor?: string;
  etag?: string;
  expiresAt?: number;
}

export interface PendingMutation<T = unknown> {
  id: string;
  idempotencyKey: string;
  scope: string;
  entityType: string;
  entityId?: string;
  operation: MutationOperation;
  payload: T;
  tombstone: boolean;
  cursor?: string;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  nextAttemptAt: number;
  lastAttemptAt?: string;
  lastError?: string;
  status: MutationStatus;
  leaseUntil?: number;
}

export interface SyncCursor {
  key: string;
  scope: string;
  collection: string;
  cursor: string | null;
  updatedAt: string;
}

export type NewMutation<T> = Pick<
  PendingMutation<T>,
  "scope" | "entityType" | "operation" | "payload"
> &
  Partial<
    Pick<
      PendingMutation<T>,
      "id" | "idempotencyKey" | "entityId" | "tombstone" | "cursor" | "createdAt"
    >
  >;

export const RETRY_BASE_MS = 2_000;
export const RETRY_MAX_MS = 15 * 60_000;

export function entityKey(scope: string, entityType: string, entityId: string): string {
  return `${encodeURIComponent(scope)}:${encodeURIComponent(entityType)}:${encodeURIComponent(entityId)}`;
}

export function cursorKey(scope: string, collection: string): string {
  return `${encodeURIComponent(scope)}:${encodeURIComponent(collection)}`;
}

export function retryDelayMs(
  attempts: number,
  random = Math.random(),
  baseMs = RETRY_BASE_MS,
  maxMs = RETRY_MAX_MS
): number {
  const exponential = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempts - 1));
  const jitter = 0.75 + Math.min(1, Math.max(0, random)) * 0.5;
  return Math.round(exponential * jitter);
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown sync error";
  }
}

export function createPendingMutation<T>(
  input: NewMutation<T>,
  now = new Date(),
  makeId: () => string = () => crypto.randomUUID()
): PendingMutation<T> {
  const idempotencyKey = input.idempotencyKey ?? input.id ?? makeId();
  const createdAt = input.createdAt ?? now.toISOString();

  return {
    id: input.id ?? idempotencyKey,
    idempotencyKey,
    scope: input.scope,
    entityType: input.entityType,
    entityId: input.entityId,
    operation: input.operation,
    payload: input.payload,
    tombstone: input.tombstone ?? input.operation === "delete",
    cursor: input.cursor,
    createdAt,
    updatedAt: createdAt,
    attempts: 0,
    nextAttemptAt: now.getTime(),
    status: "pending",
  };
}
