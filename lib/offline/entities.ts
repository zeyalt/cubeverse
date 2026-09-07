import {
  CURSOR_STORE,
  ENTITY_STORE,
  openOfflineDb,
  requestResult,
  transactionDone,
} from "./db";
import {
  cursorKey,
  entityKey,
  type EntityCacheRecord,
  type SyncCursor,
} from "./model";

export interface CacheEntityInput<T> {
  scope: string;
  entityType: string;
  entityId: string;
  value: T;
  updatedAt?: string;
  serverUpdatedAt?: string;
  cursor?: string;
  etag?: string;
  expiresAt?: number;
}

export async function cacheEntity<T>(input: CacheEntityInput<T>): Promise<void> {
  const db = await openOfflineDb();
  const transaction = db.transaction(ENTITY_STORE, "readwrite");
  const done = transactionDone(transaction);
  const record: EntityCacheRecord<T> = {
    key: entityKey(input.scope, input.entityType, input.entityId),
    scope: input.scope,
    entityType: input.entityType,
    entityId: input.entityId,
    value: input.value,
    tombstone: false,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    serverUpdatedAt: input.serverUpdatedAt,
    cursor: input.cursor,
    etag: input.etag,
    expiresAt: input.expiresAt,
  };
  transaction.objectStore(ENTITY_STORE).put(record);
  await done;
}

export async function getCachedEntity<T>(
  scope: string,
  entityType: string,
  entityId: string,
  options: { includeTombstone?: boolean; now?: number } = {}
): Promise<EntityCacheRecord<T> | null> {
  const db = await openOfflineDb();
  const transaction = db.transaction(ENTITY_STORE, "readonly");
  const done = transactionDone(transaction);
  const record = (await requestResult(
    transaction.objectStore(ENTITY_STORE).get(entityKey(scope, entityType, entityId))
  )) as EntityCacheRecord<T> | undefined;
  await done;

  if (!record) return null;
  if (!options.includeTombstone && record.tombstone) return null;
  if (record.expiresAt !== undefined && record.expiresAt <= (options.now ?? Date.now())) {
    return null;
  }
  return record;
}

export async function listCachedEntities<T>(
  scope: string,
  entityType: string,
  options: { includeTombstones?: boolean; includeExpired?: boolean; now?: number } = {}
): Promise<EntityCacheRecord<T>[]> {
  const db = await openOfflineDb();
  const transaction = db.transaction(ENTITY_STORE, "readonly");
  const done = transactionDone(transaction);
  const records = (await requestResult(
    transaction.objectStore(ENTITY_STORE).index("by-scope-type").getAll([scope, entityType])
  )) as EntityCacheRecord<T>[];
  await done;

  const now = options.now ?? Date.now();
  return records
    .filter((record) => options.includeTombstones || !record.tombstone)
    .filter(
      (record) =>
        options.includeExpired || record.expiresAt === undefined || record.expiresAt > now
    )
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
}

export async function tombstoneEntity(
  scope: string,
  entityType: string,
  entityId: string,
  updatedAt = new Date().toISOString()
): Promise<void> {
  const db = await openOfflineDb();
  const transaction = db.transaction(ENTITY_STORE, "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore(ENTITY_STORE);
  const key = entityKey(scope, entityType, entityId);
  const existing = (await requestResult(store.get(key))) as EntityCacheRecord | undefined;
  store.put({
    ...existing,
    key,
    scope,
    entityType,
    entityId,
    value: null,
    tombstone: true,
    updatedAt,
  } satisfies EntityCacheRecord);
  await done;
}

export async function setSyncCursor(
  scope: string,
  collection: string,
  cursor: string | null
): Promise<void> {
  const db = await openOfflineDb();
  const transaction = db.transaction(CURSOR_STORE, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(CURSOR_STORE).put({
    key: cursorKey(scope, collection),
    scope,
    collection,
    cursor,
    updatedAt: new Date().toISOString(),
  } satisfies SyncCursor);
  await done;
}

export async function getSyncCursor(
  scope: string,
  collection: string
): Promise<SyncCursor | null> {
  const db = await openOfflineDb();
  const transaction = db.transaction(CURSOR_STORE, "readonly");
  const done = transactionDone(transaction);
  const cursor = (await requestResult(
    transaction.objectStore(CURSOR_STORE).get(cursorKey(scope, collection))
  )) as SyncCursor | undefined;
  await done;
  return cursor ?? null;
}

export async function pruneExpiredEntities(now = Date.now()): Promise<number> {
  const db = await openOfflineDb();
  const transaction = db.transaction(ENTITY_STORE, "readwrite");
  const done = transactionDone(transaction);
  const store = transaction.objectStore(ENTITY_STORE);
  const records = (await requestResult(store.getAll())) as EntityCacheRecord[];
  const expired = records.filter(
    (record) => record.expiresAt !== undefined && record.expiresAt <= now
  );
  for (const record of expired) store.delete(record.key);
  await done;
  return expired.length;
}
