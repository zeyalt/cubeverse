export interface PendingSolve {
  id: string;
  cuberId: string;
  eventId: string;
  timeCs: number;
  penalty: "none" | "plus2" | "dnf";
  scramble: string | null;
  solvedAt: string;
}

const DB_NAME = "cubeverse-offline";
const STORE = "pending-solves";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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
  db.close();
}

export async function getPendingSolves(): Promise<PendingSolve[]> {
  const db = await openDb();
  const all = await tx<PendingSolve[]>(db, "readonly", (s) => s.getAll());
  db.close();
  return all.sort(
    (a, b) => new Date(a.solvedAt).getTime() - new Date(b.solvedAt).getTime()
  );
}

export async function getPendingCount(): Promise<number> {
  const db = await openDb();
  const count = await tx<number>(db, "readonly", (s) => s.count());
  db.close();
  return count;
}

export async function removePendingSolve(id: string): Promise<void> {
  const db = await openDb();
  await tx(db, "readwrite", (s) => s.delete(id));
  db.close();
}
