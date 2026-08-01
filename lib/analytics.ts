import type { SupabaseClient } from "@supabase/supabase-js";
import { effectiveTime, aoN, DNF, formatCs } from "./cubing";
import type { Penalty } from "./cubing";
import { practiceSummary, type PracticeSummary } from "./practiceStats";
import { fetchAllRows } from "./supabase/fetchAll";

// ─── Types sent to chart components ──────────────────────────────────────────

export interface PbPoint {
  ts: number;    // Unix ms — Recharts needs numeric X
  date: string;  // "DD MMM YYYY" for tooltip
  timeCs: number;
}

export interface PbStaircaseData {
  practiceSingle: PbPoint[];
  practiceAvg: PbPoint[];
  officialSingle: PbPoint[];
  officialAvg: PbPoint[];
}

export interface SolvePoint {
  index: number;
  ts: number;
  date: string;
  timeCs: number;
  ao5: number | null;
  ao12: number | null;
  ao50: number | null;
  cubeId: string | null;
}

export interface SolvesOverTimeData {
  points: SolvePoint[];
  compMarkers: { ts: number; name: string }[];
}

export interface DistBin {
  label: string;
  count: number;
  // Lower bound (cs) of this bin's range — lets a category-axis chart locate
  // which bin a reference value (target time, PR) falls into.
  binStart: number;
}

export type HeatmapCounts = Record<string, number>; // YYYY-MM-DD → count

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function rollingAoN(times: number[], n: number): (number | null)[] {
  return times.map((_, i) => {
    if (i < n - 1) return null;
    const slice = times.slice(i - n + 1, i + 1);
    const result = aoN(slice);
    return result === DNF ? null : result;
  });
}


// ─── PB Staircase ─────────────────────────────────────────────────────────────

export async function getPbStaircase(
  db: SupabaseClient,
  cuberId: string,
  eventId: string
): Promise<PbStaircaseData> {
  const [{ data: pbData }, { data: resultData }] = await Promise.all([
    db
      .from("pb_history")
      .select("record_type, context, time_cs, achieved_at")
      .eq("cuber_id", cuberId)
      .eq("event_id", eventId)
      .gt("time_cs", 0)
      .order("achieved_at"),
    db
      .from("results")
      .select("best_cs, average_cs, competitions(start_date)")
      .eq("cuber_id", cuberId)
      .eq("event_id", eventId),
  ]);

  const rows = pbData ?? [];

  function series(recordType: string, context: string): PbPoint[] {
    return rows
      .filter((r) => r.record_type === recordType && r.context === context)
      .map((r) => ({
        ts: new Date(r.achieved_at as string).getTime(),
        date: fmtDate(r.achieved_at as string),
        timeCs: r.time_cs as number,
      }));
  }

  // Official PB staircase is built directly from competition results so it
  // includes BOTH WCA and manually-added non-WCA competitions (the latter
  // never reach pb_history). Emit a point only where the running best improves.
  type ResultRow = {
    best_cs: number | null;
    average_cs: number | null;
    competitions: { start_date: string | null } | null;
  };
  const compResults = ((resultData ?? []) as unknown as ResultRow[])
    .filter((r): r is ResultRow & { competitions: { start_date: string } } =>
      Boolean(r.competitions?.start_date)
    )
    .sort(
      (a, b) =>
        new Date(a.competitions.start_date).getTime() -
        new Date(b.competitions.start_date).getTime()
    );

  function officialSeries(field: "best_cs" | "average_cs"): PbPoint[] {
    const pts: PbPoint[] = [];
    let best = Infinity;
    for (const r of compResults) {
      const v = r[field];
      if (v !== null && v > 0 && v < best) {
        best = v;
        const iso = r.competitions.start_date;
        pts.push({ ts: new Date(iso).getTime(), date: fmtDate(iso), timeCs: v });
      }
    }
    return pts;
  }

  return {
    practiceSingle: series("single", "practice"),
    practiceAvg: series("average", "practice"),
    officialSingle: officialSeries("best_cs"),
    officialAvg: officialSeries("average_cs"),
  };
}

// ─── Solves over time (practice) ──────────────────────────────────────────────

/** Points plotted on the Solves Over Time chart. A deliberate cap: beyond this
 *  the chart is unreadable and the payload large. */
const CHART_MAX_SOLVES = 2000;

export async function getSolvesOverTime(
  db: SupabaseClient,
  cuberId: string,
  eventId: string
): Promise<SolvesOverTimeData> {
  const [{ data: solveRowsDesc }, { data: compRows }] = await Promise.all([
    // Newest-first so the cap keeps the most recent solves; the chart is
    // reversed back to chronological order below. Ordering ascending under a
    // limit would pin the chart to the oldest solves and stop it updating
    // once a cuber passed CHART_MAX_SOLVES.
    db
      .from("solves")
      .select("time_cs, penalty, solved_at, cube_id")
      .eq("cuber_id", cuberId)
      .eq("event_id", eventId)
      .eq("context", "practice")
      .order("solved_at", { ascending: false })
      .limit(CHART_MAX_SOLVES),
    db
      .from("competitions")
      .select("name, start_date")
      .eq("cuber_id", cuberId)
      .not("start_date", "is", null)
      .order("start_date"),
  ]);

  const solveRows = (solveRowsDesc ?? []).slice().reverse();

  const effs = solveRows.map((r) =>
    effectiveTime(r.time_cs as number, r.penalty as Penalty)
  );

  const ao5s  = rollingAoN(effs, 5);
  const ao12s = rollingAoN(effs, 12);
  const ao50s = rollingAoN(effs, 50);

  const points: SolvePoint[] = solveRows.map((r, i) => ({
    index: i + 1,
    ts: new Date(r.solved_at as string).getTime(),
    date: fmtDate(r.solved_at as string),
    timeCs: effs[i] === DNF ? -1 : effs[i],
    ao5:  ao5s[i],
    ao12: ao12s[i],
    ao50: ao50s[i],
    cubeId: (r.cube_id as string | null) ?? null,
  }));

  const compMarkers = (compRows ?? [])
    .filter((c) => c.start_date)
    .map((c) => ({
      ts: new Date(c.start_date as string).getTime(),
      name: c.name as string,
    }));

  return { points, compMarkers };
}

// ─── Distribution histogram ────────────────────────────────────────────────────

/** Bin an already-filtered list of solve points into a 0.5s histogram. Pure —
 *  used client-side so the cube/date filters can update the distribution live. */
export function distributionFromPoints(points: SolvePoint[]): DistBin[] {
  const times = points.map((p) => p.timeCs).filter((t) => t > 0); // exclude DNF
  if (!times.length) return [];

  const binWidth = 50; // 0.5 s
  const min = 0; // axis always starts at 0s, matching Solves Over Time's y-axis
  const max = Math.ceil(Math.max(...times) / binWidth) * binWidth;

  const bins: Record<number, number> = {};
  for (let b = min; b < max; b += binWidth) bins[b] = 0;
  for (const t of times) {
    const b = Math.floor(t / binWidth) * binWidth;
    bins[b] = (bins[b] ?? 0) + 1;
  }
  return Object.entries(bins).map(([b, count]) => ({ label: formatCs(Number(b)), count, binStart: Number(b) }));
}

/** Count solve points per local day (YYYY-MM-DD) for the practice heatmap. */
export function heatmapFromPoints(points: SolvePoint[]): HeatmapCounts {
  const counts: HeatmapCounts = {};
  for (const p of points) {
    const d = new Date(p.ts);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    counts[day] = (counts[day] ?? 0) + 1;
  }
  return counts;
}

// The distribution and the heatmap are both derived client-side from the
// solvesOverTime points, so the cube and date-range filters update every
// practice chart together. Server-side equivalents used to exist here and were
// fetched on every analytics load, but the client discarded them unread.

// ─── Current PBs (overview table) ────────────────────────────────────────────

export interface CurrentPb {
  eventId: string;
  officialSingle: number | null;
  officialAvg: number | null;
  wcaSingle: number | null;
  wcaAvg: number | null;
  unofficialSingle: number | null;
  unofficialAvg: number | null;
  practiceSingle: number | null;
  practiceAo5: number | null;
  practiceAo12: number | null;
  practiceAo50: number | null;
  practiceAo100: number | null;
  practiceCount: number;
}

export async function getCurrentPbs(
  db: SupabaseClient,
  cuberId: string,
  eventIds: string[]
): Promise<CurrentPb[]> {
  const [{ data: pbData }, solveData, { data: resultData }] = await Promise.all([
    db
      .from("pb_history")
      .select("event_id, record_type, context, time_cs")
      .eq("cuber_id", cuberId)
      .in("event_id", eventIds)
      .in("context", ["official", "practice"])
      .gt("time_cs", 0),
    // Paged: this spans every event at once, so it is the first query to cross
    // PostgREST's row cap. Truncation here silently froze the practice averages
    // and counts on the analytics PB table.
    fetchAllRows<{ event_id: string; time_cs: number; penalty: string }>((from, to) =>
      db
        .from("solves")
        .select("event_id, time_cs, penalty")
        .eq("cuber_id", cuberId)
        .in("event_id", eventIds)
        .eq("context", "practice")
        .order("solved_at")
        .range(from, to)
    ),
    db
      .from("results")
      .select("event_id, best_cs, average_cs, competitions(type)")
      .eq("cuber_id", cuberId)
      .in("event_id", eventIds),
  ]);

  // Split competition results into WCA vs non-WCA (unofficial) best single/avg.
  type ResultRow = {
    event_id: string;
    best_cs: number | null;
    average_cs: number | null;
    competitions: { type: string } | null;
  };
  const compBest: Record<string, number> = {}; // key: `${eventId}:${wca|unofficial}:${single|average}`
  for (const r of (resultData ?? []) as unknown as ResultRow[]) {
    const isWca = (r.competitions?.type ?? "").toLowerCase() === "wca";
    const kind = isWca ? "wca" : "unofficial";
    const single = r.best_cs ?? null;
    const avg = r.average_cs ?? null;
    if (single !== null && single > 0) {
      const k = `${r.event_id}:${kind}:single`;
      if (compBest[k] === undefined || single < compBest[k]) compBest[k] = single;
    }
    if (avg !== null && avg > 0) {
      const k = `${r.event_id}:${kind}:average`;
      if (compBest[k] === undefined || avg < compBest[k]) compBest[k] = avg;
    }
  }

  // Find minimum per (event, recordType, context)
  const best: Record<string, number> = {};
  for (const r of pbData ?? []) {
    const key = `${r.event_id}:${r.record_type}:${r.context}`;
    const cur = best[key];
    if (cur === undefined || (r.time_cs as number) < cur) {
      best[key] = r.time_cs as number;
    }
  }

  // Group solves by event and calculate rolling averages
  const solvesByEvent: Record<string, Array<{ time_cs: number; penalty: string }>> = {};
  for (const solve of solveData) {
    const eventId = solve.event_id as string;
    if (!solvesByEvent[eventId]) {
      solvesByEvent[eventId] = [];
    }
    solvesByEvent[eventId].push(solve as { time_cs: number; penalty: string });
  }

  // Calculate rolling averages + best single for each event, all derived from
  // live solves so they always reflect deletions (pb_history can go stale and
  // is only used for official records below).
  // Shared with the Practice tab via practiceSummary, so the two screens can't
  // drift apart. It also only averages the tail window rather than building the
  // whole rolling series and discarding all but the last entry.
  const practiceStats: Record<string, PracticeSummary> = {};
  for (const [eventId, solves] of Object.entries(solvesByEvent)) {
    const effs = solves.map((s) => effectiveTime(s.time_cs, s.penalty as Penalty));
    practiceStats[eventId] = practiceSummary(effs);
  }

  return eventIds.map((id) => ({
    eventId: id,
    officialSingle: best[`${id}:single:official`] ?? null,
    officialAvg:    best[`${id}:average:official`] ?? null,
    wcaSingle:        compBest[`${id}:wca:single`] ?? null,
    wcaAvg:           compBest[`${id}:wca:average`] ?? null,
    unofficialSingle: compBest[`${id}:unofficial:single`] ?? null,
    unofficialAvg:    compBest[`${id}:unofficial:average`] ?? null,
    practiceSingle: practiceStats[id]?.best ?? null,
    practiceAo5:    practiceStats[id]?.ao5 ?? null,
    practiceAo12:   practiceStats[id]?.ao12 ?? null,
    practiceAo50:   practiceStats[id]?.ao50 ?? null,
    practiceAo100:  practiceStats[id]?.ao100 ?? null,
    practiceCount:  practiceStats[id]?.count ?? 0,
  }));
}

// ─── Competition Improvements ──────────────────────────────────────────────────

export interface CompetitionImprovement {
  competitionId: string;
  competitionName: string;
  date: string;
  type: "wca" | "unofficial";
  roundType: "first" | "second" | "semi" | "final";
  bestSingle: number | null;
  average: number | null;
  deltaSingle: number | null;
  deltaAverage: number | null;
}

export async function getCompetitionImprovements(
  db: SupabaseClient,
  cuberId: string,
  eventId: string
): Promise<CompetitionImprovement[]> {
  const { data } = await db
    .from("results")
    .select("id, competition_id, best_cs, average_cs, round_type, competitions(name, start_date, type)")
    .eq("cuber_id", cuberId)
    .eq("event_id", eventId)
    .order("competitions(start_date)", { ascending: true });

  if (!data || data.length === 0) return [];

  type ImprovementRow = {
    competition_id: string;
    best_cs: number | null;
    average_cs: number | null;
    round_type: string | null;
    competitions: { name: string; start_date: string; type: string } | null;
  };

  const rows = (data as unknown as ImprovementRow[])
    .filter((r): r is ImprovementRow & { competitions: NonNullable<ImprovementRow["competitions"]> } =>
      Boolean(r.competitions && r.competitions.start_date)
    )
    .sort((a, b) => {
      const dateA = new Date(a.competitions.start_date).getTime();
      const dateB = new Date(b.competitions.start_date).getTime();
      return dateA - dateB;
    });

  const results: CompetitionImprovement[] = [];
  for (let i = 0; i < rows.length; i++) {
    const curr = rows[i];
    const prev = i > 0 ? rows[i - 1] : null;

    const currSingle = (curr.best_cs as number | null) ?? null;
    const currAvg = (curr.average_cs as number | null) ?? null;
    const prevSingle = prev ? ((prev.best_cs as number | null) ?? null) : null;
    const prevAvg = prev ? ((prev.average_cs as number | null) ?? null) : null;

    const roundType = (curr.round_type as string) ?? "final";

    results.push({
      competitionId: curr.competition_id as string,
      competitionName: curr.competitions.name as string,
      date: fmtDate(curr.competitions.start_date as string),
      type: (curr.competitions.type as string).toLowerCase() === "wca" ? "wca" : "unofficial",
      roundType: roundType as "first" | "second" | "semi" | "final",
      bestSingle: currSingle,
      average: currAvg,
      deltaSingle: prevSingle !== null && currSingle !== null ? currSingle - prevSingle : null,
      deltaAverage: prevAvg !== null && currAvg !== null ? currAvg - prevAvg : null,
    });
  }

  return results;
}
