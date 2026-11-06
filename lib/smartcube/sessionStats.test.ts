import { describe, expect, it } from "vitest";
import { DNF } from "../cubing";
import { bestSingleIndex, sessionStats } from "./sessionStats";

/** Pull one row out of the table by its window size. */
const row = (times: number[], n: number) => sessionStats(times).find((r) => r.n === n)!;

describe("session stats table", () => {
  it("shows nothing for a window with too few solves", () => {
    const table = sessionStats([1_000, 1_100, 1_200]);
    expect(row([1_000, 1_100, 1_200], 5).now).toBeNull();
    expect(row([1_000, 1_100, 1_200], 5).best).toBeNull();
    // ...but the single is always available.
    expect(table[0].now).toBe(1_200);
  });

  it("reports the single as the latest solve, not the fastest", () => {
    // Easy mistake to make, and it would quietly turn the single column into a second best column.
    expect(row([1_000, 5_000], 1).now).toBe(5_000);
    expect(row([1_000, 5_000], 1).best).toBe(1_000);
  });

  it("drops best and worst for ao5, per WCA", () => {
    // Mean of 1100, 1200, 1300 — the 1000 and the 5000 are trimmed.
    expect(row([1_000, 1_100, 1_200, 1_300, 5_000], 5).now).toBe(1_200);
  });

  it("flags a record only when the latest solve set it", () => {
    const improving = row([2_000, 1_900, 1_800, 1_700, 1_000], 5);
    expect(improving.isRecord).toBe(true);

    // Two slow solves push the ao5 back up: still a best on record, no longer current. It takes
    // two, because one outlier is simply trimmed away and leaves the average untouched — which is
    // the whole point of a trimmed mean.
    const slipped = row([2_000, 1_900, 1_800, 1_700, 1_000, 9_000, 9_100], 5);
    expect(slipped.now).toBeGreaterThan(slipped.best!);
    expect(slipped.isRecord).toBe(false);
  });

  it("keeps the best ao5 from earlier in the session", () => {
    const times = [1_000, 1_100, 1_200, 1_300, 1_400, 9_000, 9_100, 9_200, 9_300];
    const ao5 = row(times, 5);
    expect(ao5.best).toBe(1_200); // the opening five
    expect(ao5.now).toBeGreaterThan(5_000);
  });

  it("never treats a DNF average as a record", () => {
    // Two DNFs in the window make the ao5 a DNF; it must not become the session best.
    const times = [1_000, 1_100, 1_200, DNF, DNF];
    const ao5 = row(times, 5);
    expect(ao5.now).toBe(DNF);
    expect(ao5.isRecord).toBe(false);
  });

  it("lets a real average after a DNF run still count as the best", () => {
    const times = [DNF, DNF, DNF, DNF, DNF, 1_000, 1_100, 1_200, 1_300, 1_400];
    expect(row(times, 5).best).toBe(1_200);
  });

  it("finds the fastest solve for the list highlight, ignoring DNFs", () => {
    expect(bestSingleIndex([2_000, 1_000, DNF, 1_500])).toBe(1);
    expect(bestSingleIndex([DNF, DNF])).toBeNull();
    expect(bestSingleIndex([])).toBeNull();
  });
});
