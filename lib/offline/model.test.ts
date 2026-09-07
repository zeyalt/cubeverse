import { describe, expect, it } from "vitest";
import {
  createPendingMutation,
  cursorKey,
  entityKey,
  errorMessage,
  retryDelayMs,
} from "./model";

describe("offline mutation model", () => {
  it("creates stable idempotency metadata", () => {
    const now = new Date("2026-09-07T00:00:00.000Z");
    const mutation = createPendingMutation(
      {
        scope: "cuber:abc",
        entityType: "solve",
        operation: "create",
        payload: { timeCs: 1234 },
      },
      now,
      () => "mutation-1"
    );

    expect(mutation).toMatchObject({
      id: "mutation-1",
      idempotencyKey: "mutation-1",
      attempts: 0,
      nextAttemptAt: now.getTime(),
      status: "pending",
      tombstone: false,
    });
  });

  it("preserves a caller-provided idempotency key", () => {
    const mutation = createPendingMutation({
      idempotencyKey: "solve:device-a:42",
      scope: "cuber:abc",
      entityType: "solve",
      operation: "create",
      payload: {},
    });

    expect(mutation.id).toBe("solve:device-a:42");
    expect(mutation.idempotencyKey).toBe("solve:device-a:42");
  });

  it("marks delete operations as tombstones", () => {
    const mutation = createPendingMutation(
      {
        scope: "account:1",
        entityType: "profile",
        entityId: "profile:1",
        operation: "delete",
        payload: null,
      },
      new Date(0),
      () => "delete-1"
    );

    expect(mutation.tombstone).toBe(true);
  });
});

describe("offline retry policy", () => {
  it("uses bounded exponential backoff with jitter", () => {
    expect(retryDelayMs(1, 0)).toBe(1_500);
    expect(retryDelayMs(2, 0.5)).toBe(4_000);
    expect(retryDelayMs(3, 1)).toBe(10_000);
    expect(retryDelayMs(99, 0.5)).toBe(15 * 60_000);
  });
});

describe("offline keys and errors", () => {
  it("escapes compound key segments", () => {
    expect(entityKey("team:a", "solve/list", "1 2")).toBe("team%3Aa:solve%2Flist:1%202");
    expect(cursorKey("team:a", "solve/list")).toBe("team%3Aa:solve%2Flist");
  });

  it("normalizes non-Error failures", () => {
    expect(errorMessage("network down")).toBe("network down");
    expect(errorMessage({ code: 503 })).toBe('{"code":503}');
  });
});
