import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrations = new URL("../../supabase/migrations/", import.meta.url);

describe("authenticated browser access", () => {
  it("scopes formerly-open tables to auth.uid", async () => {
    const sql = await readFile(new URL("0012_authenticated_family_access.sql", migrations), "utf8");
    expect(sql).toContain("competition_notes");
    expect(sql).toContain("benchmark_competitors");
    expect(sql.match(/owner_id = \(select auth\.uid\(\)\)/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("restricts media writes to the signed-in owner's folder", async () => {
    const sql = await readFile(new URL("0012_authenticated_family_access.sql", migrations), "utf8");
    expect(sql).toContain("to authenticated");
    expect(sql).toContain("(storage.foldername(name))[1] = (select auth.uid())::text");
  });

  it("keeps optimized solve RPCs unavailable to anonymous callers", async () => {
    const sql = await readFile(new URL("0011_practice_data_paths.sql", migrations), "utf8");
    expect(sql).toContain("revoke all on function record_practice_solve");
    expect(sql).toContain("to authenticated, service_role");
    expect(sql).toContain("client_idempotency_key");
  });
});
