import type { PendingMutation } from "./model";

export const DB_NAME = "cubeverse-offline";
export const DB_VERSION = 2;
export const ENTITY_STORE = "entities";
export const OUTBOX_STORE = "outbox";
export const CURSOR_STORE = "sync-cursors";
export const LEGACY_SOLVE_STORE = "pending-solves";

let dbPromise: Promise<IDBDatabase> | null = null;

function createSchema(db: IDBDatabase) {
  if (!db.objectStoreNames.contains(ENTITY_STORE)) {
    const entities = db.createObjectStore(ENTITY_STORE, { keyPath: "key" });
    entities.createIndex("by-scope-type", ["scope", "entityType"]);
    entities.createIndex("by-updated-at", "updatedAt");
    entities.createIndex("by-expires-at", "expiresAt");
  }

  if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
    const outbox = db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
    outbox.createIndex("by-idempotency", "idempotencyKey", { unique: true });
    outbox.createIndex("by-scope-type", ["scope", "entityType"]);
    outbox.createIndex("by-next-attempt", "nextAttemptAt");
    outbox.createIndex("by-entity", ["scope", "entityType", "entityId"]);
  }

  if (!db.objectStoreNames.contains(CURSOR_STORE)) {
    const cursors = db.createObjectStore(CURSOR_STORE, { keyPath: "key" });
    cursors.createIndex("by-scope", "scope");
  }

  // Retained so upgrades can safely migrate existing v1 solve queues.
  if (!db.objectStoreNames.contains(LEGACY_SOLVE_STORE)) {
    db.createObjectStore(LEGACY_SOLVE_STORE, { keyPath: "id" });
  }
}

function migrateLegacySolves(transaction: IDBTransaction) {
  const legacy = transaction.objectStore(LEGACY_SOLVE_STORE);
  const outbox = transaction.objectStore(OUTBOX_STORE);
  const request = legacy.openCursor();

  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;

    const solve = cursor.value as Record<string, unknown> & {
      id: string;
      cuberId?: string;
      solvedAt?: string;
    };
    const createdAt = solve.solvedAt ?? new Date().toISOString();
    const mutation: PendingMutation<typeof solve> = {
      id: solve.id,
      idempotencyKey: solve.id,
      scope: solve.cuberId ? `cuber:${solve.cuberId}` : "legacy",
      entityType: "solve",
      entityId: solve.id,
      operation: "create",
      payload: solve,
      tombstone: false,
      createdAt,
      updatedAt: createdAt,
      attempts: 0,
      nextAttemptAt: Date.parse(createdAt) || Date.now(),
      status: "pending",
    };
    outbox.put(mutation);
    cursor.continue();
  };
}

export function openOfflineDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is unavailable in this environment"));
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const oldVersion = event.oldVersion;
      createSchema(request.result);
      if (oldVersion > 0 && oldVersion < 2) migrateLegacySolves(request.transaction!);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error("Unable to open offline database"));
    };
  });

  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}
