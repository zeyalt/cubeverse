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
  practiceAvg: number | null;
}

export async function getCurrentPbs(
  db: SupabaseClient,
  cuberId: string,
  eventIds: string[]
): Promise<CurrentPb[]> {
  const { data } = await db
    .from("pb_history")
    .select("event_id, record_type, context, time_cs")
    .eq("cuber_id", cuberId)
    .in("event_id", eventIds)
    .in("context", ["official", "practice"])
    .gt("time_cs", 0);

  // Find minimum per (event, recordType, context)
  const best: Record<string, number> = {};
  for (const r of data ?? []) {
    const key = `${r.event_id}:${r.record_type}:${r.context}`;
    const cur = best[key];
    if (cur === undefined || (r.time_cs as number) < cur) {
      best[key] = r.time_cs as number;
    }
  }

  return eventIds.map((id) => ({
    eventId: id,
    officialSingle: best[`${id}:single:official`] ?? null,
    officialAvg:    best[`${id}:average:official`] ?? null,
    practiceSingle: best[`${id}:single:practice`] ?? null,
    practiceAvg:    best[`${id}:average:practice`] ?? null,
  }));
}
