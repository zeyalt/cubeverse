import type { SupabaseClient } from "@supabase/supabase-js";
import { effectiveTime } from "@/lib/cubing";
import type { Penalty } from "@/lib/cubing";
import { practiceSummary } from "@/lib/practiceStats";
import { getCurrentPbs } from "@/lib/analytics";
import { getAnalyticsData, type AnalyticsPayload } from "@/app/actions/analytics";
import { sharedHardwareEvents } from "@/lib/eventGroups";
import { fetchAllRows } from "@/lib/supabase/fetchAll";

/**
 * Per-tab data loaders for kid mode.
 *
 * These live outside the page so the same code can serve both the initial
 * server render (app/page.tsx) and on-demand tab switches from the client
 * (app/actions/tabs.ts). They take `db` as a parameter, matching the
 * convention in lib/analytics.ts.
 */

export type Tab = "practice" | "competitions" | "analytics" | "badges" | "cubes";

export const ACTIVE_EVENTS = ["333", "222", "pyram", "skewb", "clock", "444", "333oh"];

export interface EventRow {
  id: string;
  name: string;
  format: string;
}

export interface ShellData {
  cuberName: string;
  events: EventRow[];
  cubers: Array<{
    id: string;
    name: string;
    display_name: string | null;
    avatar_color: string;
  }>;
}

/**
 * The active event list. Several tab loaders need it for ordering and display
 * names, so it's fetched separately from the rest of the shell — an on-demand
 * tab switch shouldn't have to re-fetch the cuber and the cuber list too.
 */
export async function loadEvents(db: SupabaseClient): Promise<EventRow[]> {
  const { data } = await db
    .from("events")
    .select("id, name, format")
    .gte("sort_order", 1)
    .lte("sort_order", 7)
    .order("sort_order");
  return (data ?? []) as EventRow[];
}

export async function loadShell(
  db: SupabaseClient,
  ownerId: string,
  cuberId: string
): Promise<ShellData> {
  const [{ data: cuber }, events, { data: allCubers }] = await Promise.all([
    db.from("cubers").select("name, display_name").eq("id", cuberId).single(),
    loadEvents(db),
    db
      .from("cubers")
      .select("id, name, display_name, avatar_color")
      .eq("owner_id", ownerId)
      .order("name"),
  ]);

  return {
    cuberName: cuber?.display_name ?? cuber?.name ?? "Cuber",
    events,
    cubers: (allCubers ?? []) as ShellData["cubers"],
  };
}

// ─── Practice ────────────────────────────────────────────────────────────────

/**
 * How many recent effective times to send to the client. ao100 is the widest
 * window, so 100 would technically do; the margin covers the append/discard
 * mutations the client applies on top without needing another round-trip.
 */
export const PRACTICE_TAIL = 120;

export interface PracticeTabData {
  events: EventRow[];
  defaultEventId: string;
  cuberId: string;
  cubes: { id: string; name: string; brand: string | null; event_id: string | null }[];
  selectedCubeId: string | null;
  activeGoal: { id: string; target_cs: number } | null;
  ao5: number | null;
  ao12: number | null;
  ao50: number | null;
  ao100: number | null;
  best: number | null;
  count: number;
  recentTimes: number[];
}

export async function loadPracticeTab(
  db: SupabaseClient,
  ownerId: string,
  cuberId: string,
  eventId: string,
  events: EventRow[],
  savedCubeId: string | null
): Promise<PracticeTabData> {
  const [allSolves, { data: practiceGoal }, { data: practiceCubes }] =
    await Promise.all([
      // Paged — `best` and `count` describe the whole history, so a silently
      // truncated response would understate both once this event passes
      // PostgREST's row cap.
      fetchAllRows<{ time_cs: number; penalty: string }>((from, to) =>
        db
          .from("solves")
          .select("time_cs, penalty")
          .eq("cuber_id", cuberId)
          .eq("event_id", eventId)
          .eq("context", "practice")
          .order("solved_at")
          .range(from, to)
      ),
      db
        .from("goals")
        .select("id, target_cs")
        .eq("cuber_id", cuberId)
        .eq("event_id", eventId)
        .eq("record_type", "single")
        .eq("status", "active")
        .maybeSingle(),
      db
        .from("cubes")
        .select("id, name, brand, event_id")
        .eq("owner_id", ownerId)
        .in("event_id", sharedHardwareEvents(eventId))
        .order("is_main", { ascending: false })
        .order("name"),
    ]);

  // Effective times preserve DNFs (= -1) so the WCA-correct aoN() can treat a
  // DNF as the worst time in a window.
  const times = allSolves.map((s) =>
    effectiveTime(s.time_cs as number, s.penalty as Penalty)
  );

  const cubes = (practiceCubes ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    brand: c.brand as string | null,
    event_id: c.event_id as string | null,
  }));

  return {
    events,
    defaultEventId: eventId,
    cuberId,
    cubes,
    selectedCubeId:
      savedCubeId && cubes.some((c) => c.id === savedCubeId) ? savedCubeId : null,
    activeGoal: practiceGoal
      ? { id: practiceGoal.id as string, target_cs: practiceGoal.target_cs as number }
      : null,
    // ao5/ao12/ao50/ao100 plus the all-time best and count, computed over the
    // complete history.
    ...practiceSummary(times),
    // Only the tail is sent. The client recomputes the rolling averages after
    // each in-session solve, and the widest window is ao100 — so anything
    // beyond the last PRACTICE_TAIL times can never change a displayed metric,
    // and shipping a cuber's entire solve history on every load was pure
    // payload. `best` and `count` above still reflect everything.
    recentTimes: times.slice(-PRACTICE_TAIL),
  };
}

// ─── Competitions ────────────────────────────────────────────────────────────

export interface CompetitionTabData {
  competitions: Array<{
    id: string;
    name: string;
    type: string;
    city: string | null;
    country: string | null;
    start_date: string | null;
    end_date: string | null;
    eventIds: string[];
  }>;
  cuberId: string;
  wcaId: string | null;
}

export async function loadCompetitionsTab(
  db: SupabaseClient,
  cuberId: string,
  events: EventRow[]
): Promise<CompetitionTabData> {
  const [{ data: comps }, { data: cuber }, { data: compResults }] = await Promise.all([
    db
      .from("competitions")
      .select("id, name, type, city, country, start_date, end_date")
      .eq("cuber_id", cuberId)
      .order("start_date", { ascending: false }),
    db.from("cubers").select("wca_id").eq("id", cuberId).single(),
    db.from("results").select("competition_id, event_id").eq("cuber_id", cuberId),
  ]);

  // Distinct events per competition, kept in canonical event order.
  const eventOrder = new Map(events.map((e, i) => [e.id, i]));
  const eventsByComp = new Map<string, Set<string>>();
  for (const r of compResults ?? []) {
    const cid = r.competition_id as string;
    if (!eventsByComp.has(cid)) eventsByComp.set(cid, new Set());
    eventsByComp.get(cid)!.add(r.event_id as string);
  }

  return {
    competitions: (comps ?? []).map((c) => ({
      ...c,
      eventIds: [...(eventsByComp.get(c.id as string) ?? [])].sort(
        (a, b) => (eventOrder.get(a) ?? 99) - (eventOrder.get(b) ?? 99)
      ),
    })) as CompetitionTabData["competitions"],
    cuberId,
    wcaId: cuber?.wca_id ?? null,
  };
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface Cube {
  id: string;
  name: string;
  brand: string | null;
  event_id: string | null;
}

export interface AnalyticsTabData {
  events: EventRow[];
  defaultEventId: string;
  cuberId: string;
  initialAnalyticsData: AnalyticsPayload;
  pbs: Awaited<ReturnType<typeof getCurrentPbs>>;
  cubes: Cube[];
  wcaId: string | null;
}

export async function loadAnalyticsTab(
  db: SupabaseClient,
  ownerId: string,
  cuberId: string,
  eventId: string,
  events: EventRow[]
): Promise<AnalyticsTabData> {
  const [pbs, initialData, { data: cubes }, { data: cuber }] = await Promise.all([
    getCurrentPbs(db, cuberId, ACTIVE_EVENTS),
    getAnalyticsData(cuberId, eventId),
    db
      .from("cubes")
      .select("id, name, brand, event_id")
      .eq("owner_id", ownerId)
      .order("is_main", { ascending: false })
      .order("created_at"),
    // Same lookup loadCompetitionsTab already does — needed here too so the
    // Competitor Benchmarking section knows the cuber's own WCA ID.
    db.from("cubers").select("wca_id").eq("id", cuberId).single(),
  ]);

  return {
    events,
    defaultEventId: eventId,
    cuberId,
    initialAnalyticsData: initialData,
    pbs,
    cubes: (cubes ?? []) as Cube[],
    wcaId: (cuber?.wca_id as string | null) ?? null,
  };
}

// ─── Badges ──────────────────────────────────────────────────────────────────

export interface BadgesTabData {
  achievements: Array<{
    badge_key: string;
    unlocked_at: string | null;
    metadata: Record<string, unknown> | null;
  }>;
  unlockedCount: number;
  totalCount: number;
  pbs: Awaited<ReturnType<typeof getCurrentPbs>>;
  solveCount: number;
  compCount: number;
  streak: number;
}

export async function loadBadgesTab(
  db: SupabaseClient,
  cuberId: string
): Promise<BadgesTabData> {
  const { BADGE_TIERS, ACTIVITY_BADGES } = await import("@/lib/badges");
  const { computeStreak } = await import("@/lib/streak");

  const [
    { data: achievements },
    pbs,
    { count: solveCount },
    { count: compCount },
    streak,
  ] = await Promise.all([
    db
      .from("achievements")
      .select("badge_key, unlocked_at, metadata")
      .eq("cuber_id", cuberId)
      .order("unlocked_at", { ascending: false }),
    getCurrentPbs(db, cuberId, ACTIVE_EVENTS),
    db.from("solves").select("id", { count: "exact", head: true })
      .eq("cuber_id", cuberId).eq("context", "practice"),
    db.from("competitions").select("id", { count: "exact", head: true })
      .eq("cuber_id", cuberId),
    computeStreak(db, cuberId),
  ]);

  return {
    achievements: (achievements ?? []) as BadgesTabData["achievements"],
    unlockedCount: achievements?.length ?? 0,
    totalCount: BADGE_TIERS.length + ACTIVITY_BADGES.length,
    pbs,
    solveCount: solveCount ?? 0,
    compCount: compCount ?? 0,
    streak,
  };
}

// ─── Cubes ───────────────────────────────────────────────────────────────────

export interface CubesTabData {
  cubes: Array<{
    id: string;
    name: string;
    brand: string | null;
    eventId: string | null;
    eventName: string | null;
    isMain: boolean;
    photoUrl: string | null;
    acquiredOn: string | null;
    notes: string | null;
  }>;
  events: Array<{ id: string; name: string }>;
  cuberId: string;
  defaultEventId: string;
}

export async function loadCubesTab(
  db: SupabaseClient,
  ownerId: string,
  cuberId: string,
  eventId: string,
  events: EventRow[]
): Promise<CubesTabData> {
  const { data: cubes } = await db
    .from("cubes")
    .select("id, name, brand, event_id, is_main, photo_url, acquired_on, notes")
    .eq("owner_id", ownerId)
    .order("is_main", { ascending: false })
    .order("created_at");

  const eventNames = Object.fromEntries(events.map((e) => [e.id, e.name]));

  return {
    cubes: (cubes ?? []).map((c) => ({
      id: c.id as string,
      name: c.name as string,
      brand: c.brand as string | null,
      eventId: c.event_id as string | null,
      eventName: c.event_id ? eventNames[c.event_id as string] ?? null : null,
      isMain: c.is_main as boolean,
      photoUrl: c.photo_url as string | null,
      acquiredOn: c.acquired_on as string | null,
      notes: c.notes as string | null,
    })),
    events: events.map((e) => ({ id: e.id, name: e.name })),
    cuberId,
    defaultEventId: eventId,
  };
}
