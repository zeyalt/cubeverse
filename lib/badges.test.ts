import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkActivityBadges } from "./badges";
import { ACTIVE_EVENTS } from "./event-theme";

type Row = Record<string, string>;

/** Just enough of the Supabase query builder for checkActivityBadges. */
function fakeDb(tables: { results: Row[]; achievements: Row[] }) {
  const upserted: Row[] = [];
  const db = {
    from(table: "results" | "achievements") {
      let rows = tables[table];
      const query = {
        select: () => query,
        eq: (col: string, value: string) => ((rows = rows.filter((r) => r[col] === value)), query),
        in: (col: string, values: string[]) => ((rows = rows.filter((r) => values.includes(r[col]))), query),
        then: (resolve: (v: { data: Row[] }) => void) => resolve({ data: rows }),
        upsert: async (newRows: Row[]) => (upserted.push(...newRows), { error: null }),
      };
      return query;
    },
  };
  return { db: db as unknown as SupabaseClient, upserted };
}

const results = (competitionId: string, events: string[]) =>
  events.map((event_id) => ({ cuber_id: "c1", competition_id: competitionId, event_id }));

describe("checkActivityBadges (competitions)", () => {
  it("unlocks first_comp and 5_comps from the competition count", async () => {
    const { db, upserted } = fakeDb({ results: [], achievements: [] });
    const unlocked = await checkActivityBadges(db, "o1", "c1", { compCount: 5 });
    expect(unlocked).toEqual(["first_comp", "5_comps"]);
    expect(upserted.map((r) => r.badge_key)).toEqual(["first_comp", "5_comps"]);
  });

  it("unlocks all_events only when one competition covers every active event", async () => {
    const spread = results("a", ACTIVE_EVENTS.slice(0, 4)).concat(results("b", ACTIVE_EVENTS.slice(4)));
    expect(await checkActivityBadges(fakeDb({ results: spread, achievements: [] }).db, "o1", "c1", { compCount: 2 }))
      .not.toContain("all_events_in_one_comp");

    const together = results("a", ACTIVE_EVENTS);
    expect(await checkActivityBadges(fakeDb({ results: together, achievements: [] }).db, "o1", "c1", { compCount: 1 }))
      .toContain("all_events_in_one_comp");
  });

  it("skips badges that are already unlocked", async () => {
    const { db, upserted } = fakeDb({
      results: [],
      achievements: [{ cuber_id: "c1", badge_key: "first_comp" }],
    });
    expect(await checkActivityBadges(db, "o1", "c1", { compCount: 1 })).toEqual([]);
    expect(upserted).toEqual([]);
  });
});
