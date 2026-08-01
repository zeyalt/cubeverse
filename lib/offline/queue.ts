export interface PendingSolve {
  id: string;
  cuberId: string;
  eventId: string;
  timeCs: number;
  penalty: "none" | "plus2" | "dnf";
  scramble: string | null;
  solvedAt: string;
  cubeId?: string;
}

const DB_NAME = "cubeverse-offline";
const STORE = "pending-solves";
const DB_VERSION = 1;

// The connection is opened once and reused. Every call used to open and close
// its own, which on a polling loop meant a steady drip of connection setup for
// what is usually an empty queue.
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // A held-open connection blocks another tab from upgrading the schema.
      // Step aside when that happens; the next call reopens.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });

  // Don't cache a rejected promise — a transient failure would otherwise stick
  // for the lifetime of the page.
  dbPromise.catch(() => {
    dbPromise = null;
  });

  return dbPromise;
}

function tx<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueSolve(
  solve: Omit<PendingSolve, "id" | "solvedAt"> & { solvedAt?: string }
): Promise<void> {
  const db = await openDb();
  const row: PendingSolve = {
    ...solve,
    id: crypto.randomUUID(),
    solvedAt: solve.solvedAt ?? new Date().toISOString(),
  };
  await tx(db, "readwrite", (s) => s.add(row));
}

export async function getPendingSolves(): Promise<PendingSolve[]> {
  const db = await openDb();
  const all = await tx<PendingSolve[]>(db, "readonly", (s) => s.getAll());
  return all.sort(
    (a, b) => new Date(a.solvedAt).getTime() - new Date(b.solvedAt).getTime()
  );
}

export async function getPendingCount(): Promise<number> {
  const db = await openDb();
  const count = await tx<number>(db, "readonly", (s) => s.count());
  return count;
}

export async function removePendingSolve(id: string): Promise<void> {
  const db = await openDb();
  await tx(db, "readwrite", (s) => s.delete(id));
}
