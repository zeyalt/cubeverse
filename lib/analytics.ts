import type { SupabaseClient } from "@supabase/supabase-js";
import { effectiveTime, aoN, DNF, formatCs } from "./cubing";
import type { Penalty } from "./cubing";

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
}

export interface SolvesOverTimeData {
  points: SolvePoint[];
  compMarkers: { ts: number; name: string }[];
}

export interface DistBin {
  label: string;
  count: number;
}

export interface ConsistencyPoint {
  index: number;
  stdDev: number | null; // cs
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

function rollingStdDev(times: number[], window: number): (number | null)[] {
  return times.map((_, i) => {
    if (i < window - 1) return null;
    const slice = times.slice(i - window + 1, i + 1).filter((t) => t > 0);
    if (slice.length < 2) return null;
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance =
      slice.reduce((s, t) => s + (t - mean) ** 2, 0) / (slice.length - 1);
    return Math.round(Math.sqrt(variance));
  });
}

// ─── PB Staircase ─────────────────────────────────────────────────────────────

export async function getPbStaircase(
  db: SupabaseClient,
  cuberId: string,
  eventId: string
): Promise<PbStaircaseData> {
  const { data } = await db
    .from("pb_history")
    .select("record_type, context, time_cs, achieved_at")
    .eq("cuber_id", cuberId)
    .eq("event_id", eventId)
    .gt("time_cs", 0)
    .order("achieved_at");

  const rows = data ?? [];

  function series(recordType: string, context: string): PbPoint[] {
    return rows
      .filter((r) => r.record_type === recordType && r.context === context)
      .map((r) => ({
        ts: new Date(r.achieved_at as string).getTime(),
        date: fmtDate(r.achieved_at as string),
        timeCs: r.time_cs as number,
      }));
  }

  return {
    practiceSingle: series("single", "practice"),
    practiceAvg: series("average", "practice"),
    officialSingle: series("single", "official"),
    officialAvg: series("average", "official"),
  };
}

// ─── Solves over time (practice) ──────────────────────────────────────────────

export async function getSolvesOverTime(
  db: SupabaseClient,
  cuberId: string,
  eventId: string
): Promise<SolvesOverTimeData> {
  const [{ data: solveRows }, { data: compRows }] = await Promise.all([
    db
      .from("solves")
      .select("time_cs, penalty, solved_at")
      .eq("cuber_id", cuberId)
      .eq("event_id", eventId)
      .eq("context", "practice")
      .order("solved_at")
      .limit(2000),
    db
      .from("competitions")
      .select("name, start_date")
      .eq("cuber_id", cuberId)
      .not("start_date", "is", null)
      .order("start_date"),
  ]);

  const effs = (solveRows ?? []).map((r) =>
    effectiveTime(r.time_cs as number, r.penalty as Penalty)
  );

  const ao5s  = rollingAoN(effs, 5);
  const ao12s = rollingAoN(effs, 12);
  const ao50s = rollingAoN(effs, 50);

  const points: SolvePoint[] = (solveRows ?? []).map((r, i) => ({
    index: i + 1,
    ts: new Date(r.solved_at as string).getTime(),
    date: fmtDate(r.solved_at as string),
    timeCs: effs[i] === DNF ? -1 : effs[i],
    ao5:  ao5s[i],
    ao12: ao12s[i],
    ao50: ao50s[i],
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

export async function getSolveDistribution(
  db: SupabaseClient,
  cuberId: string,
  eventId: string
): Promise<DistBin[]> {
  const { data } = await db
    .from("solves")
    .select("time_cs, penalty")
    .eq("cuber_id", cuberId)
    .eq("event_id", eventId)
    .eq("context", "practice")
    .limit(5000);

  const times = (data ?? [])
    .map((r) => effectiveTime(r.time_cs as number, r.penalty as Penalty))
    .filter((t) => t > 0); // exclude DNF

  if (!times.length) return [];

  const binWidth = 50; // 0.5 s
  const min = Math.floor(Math.min(...times) / binWidth) * binWidth;
  const max = Math.ceil(Math.max(...times) / binWidth) * binWidth;

  const bins: Record<number, number> = {};
  for (let b = min; b < max; b += binWidth) bins[b] = 0;
  for (const t of times) {
    const b = Math.floor(t / binWidth) * binWidth;
    bins[b] = (bins[b] ?? 0) + 1;
  }

  return Object.entries(bins).map(([b, count]) => ({
    label: formatCs(Number(b)),
    count,
  }));
}

// ─── Consistency (rolling std dev) ───────────────────────────────────────────

export async function getConsistency(
  db: SupabaseClient,
  cuberId: string,
  eventId: string,
  window = 20
): Promise<ConsistencyPoint[]> {
  const { data } = await db
    .from("solves")
    .select("time_cs, penalty")
    .eq("cuber_id", cuberId)
    .eq("event_id", eventId)
    .eq("context", "practice")
    .order("solved_at")
    .limit(2000);

  const effs = (data ?? [])
    .map((r) => effectiveTime(r.time_cs as number, r.penalty as Penalty))
    .filter((t) => t > 0);

  return rollingStdDev(effs, window).map((v, i) => ({
    index: i + 1,
    stdDev: v,
  }));
}

// ─── Practice heatmap ─────────────────────────────────────────────────────────

export async function getHeatmapCounts(
  db: SupabaseClient,
  cuberId: string,
  days = 364
): Promise<HeatmapCounts> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await db
    .from("solves")
    .select("solved_at")
    .eq("cuber_id", cuberId)
    .eq("context", "practice")
    .gte("solved_at", since);

  const counts: HeatmapCounts = {};
  for (const row of data ?? []) {
    const day = (row.solved_at as string).slice(0, 10);
    counts[day] = (counts[day] ?? 0) + 1;
  }
  return counts;
}

// ─── Current PBs (overview table) ────────────────────────────────────────────

export interface CurrentPb {
  eventId: string;
  officialSingle: number | null;
  officialAvg: number | null;
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
  const [{ data: pbData }, { data: solveData }] = await Promise.all([
    db
      .from("pb_history")
      .select("event_id, record_type, context, time_cs")
      .eq("cuber_id", cuberId)
      .in("event_id", eventIds)
      .in("context", ["official", "practice"])
      .gt("time_cs", 0),
    db
      .from("solves")
      .select("event_id, time_cs, penalty")
      .eq("cuber_id", cuberId)
      .in("event_id", eventIds)
      .eq("context", "practice")
      .order("solved_at"),
  ]);

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
  for (const solve of solveData ?? []) {
    const eventId = solve.event_id as string;
    if (!solvesByEvent[eventId]) {
      solvesByEvent[eventId] = [];
    }
    solvesByEvent[eventId].push(solve as { time_cs: number; penalty: string });
  }

  // Calculate rolling averages + best single for each event, all derived from
  // live solves so they always reflect deletions (pb_history can go stale and
  // is only used for official records below).
  const practiceStats: Record<string, { single: number | null; ao5: number | null; ao12: number | null; ao50: number | null; ao100: number | null; count: number }> = {};
  for (const [eventId, solves] of Object.entries(solvesByEvent)) {
    const effs = solves.map((s) => effectiveTime(s.time_cs, s.penalty as Penalty));
    const ao5s = rollingAoN(effs, 5);
    const ao12s = rollingAoN(effs, 12);
    const ao50s = rollingAoN(effs, 50);
    const ao100s = rollingAoN(effs, 100);

    // Best single = fastest non-DNF effective time across all solves.
    const nonDnf = effs.filter((t) => t > 0);
    const single = nonDnf.length > 0 ? Math.min(...nonDnf) : null;

    const lastIdx = effs.length - 1;
    practiceStats[eventId] = {
      single,
      ao5: lastIdx >= 4 ? ao5s[lastIdx] : null,
      ao12: lastIdx >= 11 ? ao12s[lastIdx] : null,
      ao50: lastIdx >= 49 ? ao50s[lastIdx] : null,
      ao100: lastIdx >= 99 ? ao100s[lastIdx] : null,
      count: effs.length,
    };
  }

  return eventIds.map((id) => ({
    eventId: id,
    officialSingle: best[`${id}:single:official`] ?? null,
    officialAvg:    best[`${id}:average:official`] ?? null,
    practiceSingle: practiceStats[id]?.single ?? null,
    practiceAo5:    practiceStats[id]?.ao5 ?? null,
    practiceAo12:   practiceStats[id]?.ao12 ?? null,
    practiceAo50:   practiceStats[id]?.ao50 ?? null,
    practiceAo100:  practiceStats[id]?.ao100 ?? null,
    practiceCount:  practiceStats[id]?.count ?? 0,
  }));
}

// ─── Competition Improvements ──────────────────────────────────────────────────

export interface CompetitionImprovement {
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

  const rows = (data as any[])
    .filter((r) => r.competitions && r.competitions.start_date)
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
