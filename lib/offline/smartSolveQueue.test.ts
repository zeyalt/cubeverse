import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingMutation } from "./model";
import type { SmartSolveInput } from "@/lib/client/smartSolves";

/**
 * The outbox is IndexedDB-backed and the suite runs in node, so the store itself is replaced with
 * an array. That is deliberate rather than a shortcut: what needs guarding here isn't IndexedDB
 * (it has its own tests via `model.test.ts`) but the **payload crossing the queue intact**.
 *
 * The practice-solve queue lists its fields three times — interface, enqueue, and the explicit
 * argument object in `sync.ts` — and a field present in the first two but missing from the third
 * is dropped on sync with no error raised anywhere. For a smart solve that would quietly lose the
 * move stream and the reconstruction while reporting success. These tests fail if anyone
 * reintroduces field-by-field copying on either side.
 */

const rows: PendingMutation<SmartSolveInput>[] = [];

vi.mock("./outbox", () => ({
  enqueueMutation: vi.fn(async (input) => {
    const row = { ...input, id: `row-${rows.length + 1}`, attempts: 0, nextAttemptAt: 0 };
    rows.push(row);
    return row;
  }),
  listMutations: vi.fn(async ({ entityType }: { entityType?: string }) =>
    rows.filter((r) => !entityType || r.entityType === entityType)
  ),
  claimMutation: vi.fn(async (id: string) => rows.find((r) => r.id === id) ?? null),
  removeMutation: vi.fn(async (id: string) => {
    const i = rows.findIndex((r) => r.id === id);
    if (i >= 0) rows.splice(i, 1);
  }),
  markMutationFailed: vi.fn(async () => {}),
}));

type SaveResult = { id: string | null; error: string | null };
const recordSmartSolve =
  vi.fn<(input: SmartSolveInput) => Promise<SaveResult>>(async () => ({ id: "saved", error: null }));
vi.mock("@/lib/client/smartSolves", () => ({ recordSmartSolve: (i: SmartSolveInput) => recordSmartSolve(i) }));
vi.mock("@/lib/client/actions", () => ({ recordSolve: vi.fn() }));
vi.mock("./queue", () => ({
  getPendingSolves: vi.fn(async () => []),
  claimPendingSolve: vi.fn(),
  markPendingSolveFailed: vi.fn(),
  removePendingSolve: vi.fn(),
}));

const { enqueueSmartSolve, getQueuedSmartSolves, SMART_SOLVE_ENTITY } = await import(
  "./smartSolveQueue"
);
const { syncQueuedSmartSolves } = await import("./sync");

/** Every field a smart solve carries, with a distinguishable value for each. */
const SOLVE: SmartSolveInput = {
  cuberId: "cuber-1",
  eventId: "333",
  timeCs: 1_234,
  penalty: "plus2",
  scramble: "R U R' U'",
  moveStream: "Aa1Bb2",
  moveStreamVersion: 1,
  reconstruction: {
    method: "cfop",
    steps: [],
    totalMs: 12_340,
    moveCount: 42,
    turns: 38,
    tps: 3.1,
    fluency: 0.64,
    pauseCount: 5,
    crossColor: "D",
    confidence: "high",
  },
  timingSource: "cube",
  confidence: "high",
  cubeName: "GANi4_5B84",
  solvedAt: "2026-11-07T10:00:00.000Z",
  idempotencyId: "11111111-1111-1111-1111-111111111111",
};

beforeEach(() => {
  rows.length = 0;
  recordSmartSolve.mockClear();
  recordSmartSolve.mockResolvedValue({ id: "saved", error: null });
  vi.stubGlobal("navigator", { onLine: true });
});

describe("smart-solve offline queue", () => {
  it("queues under its own entity type, never the practice one", () => {
    // Sharing "solve" would route a smart solve through record_practice_solve on flush, which is
    // precisely the isolation this feature promises not to break.
    expect(SMART_SOLVE_ENTITY).toBe("smartSolve");
    expect(SMART_SOLVE_ENTITY).not.toBe("solve");
  });

  it("keeps every field through enqueue and read-back", async () => {
    await enqueueSmartSolve(SOLVE);
    const [queued] = await getQueuedSmartSolves();
    expect(queued.payload).toEqual(SOLVE);
    // Key for key, so a newly added field can't pass by being merely undefined.
    expect(Object.keys(queued.payload).sort()).toEqual(Object.keys(SOLVE).sort());
  });

  it("hands the server exactly what was queued", async () => {
    await enqueueSmartSolve(SOLVE);
    const result = await syncQueuedSmartSolves();

    expect(result.synced).toBe(1);
    expect(recordSmartSolve).toHaveBeenCalledWith(SOLVE);
    // The move stream and the reconstruction are the two things a field-by-field copy loses, and
    // losing them silently is worse than failing: the solve looks saved but the replay is gone.
    const sent = recordSmartSolve.mock.calls[0][0];
    expect(sent.moveStream).toBe(SOLVE.moveStream);
    expect(sent.reconstruction).toEqual(SOLVE.reconstruction);
  });

  it("clears the queue only on a real success", async () => {
    await enqueueSmartSolve(SOLVE);
    await syncQueuedSmartSolves();
    expect(await getQueuedSmartSolves()).toHaveLength(0);
  });

  it("keeps the solve queued when the server rejects it", async () => {
    // recordSmartSolve resolves with an error rather than throwing, so a flusher that only
    // catches rejections would delete this solve and lose it for good.
    recordSmartSolve.mockResolvedValue({ id: null, error: "row-level security violation" });
    await enqueueSmartSolve(SOLVE);
    const result = await syncQueuedSmartSolves();

    expect(result.synced).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toMatch(/row-level security/);
    expect(await getQueuedSmartSolves()).toHaveLength(1);
  });

  it("does nothing while offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    await enqueueSmartSolve(SOLVE);
    expect(await syncQueuedSmartSolves()).toEqual({ synced: 0, failed: 0, errors: [] });
    expect(recordSmartSolve).not.toHaveBeenCalled();
  });
});
