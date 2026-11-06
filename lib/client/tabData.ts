import { requireUser } from "@/lib/supabase/auth";
import { cacheEntity, getCachedEntity } from "@/lib/offline/entities";
import type {
  AnalyticsTabData,
  BadgesTabData,
  CompetitionTabData,
  EventRow,
  PracticeTabData,
  ShellData,
  Tab,
  TrainerTabData,
} from "@/lib/kid/tabData";
import {
  getCompetitionImprovements,
  getPbStaircase,
  getSolvesOverTime,
  type CompetitionImprovement,
  type CurrentPb,
  type PbStaircaseData,
  type SolvesOverTimeData,
} from "@/lib/analytics";
import { CLL_TRAINER_KEY, normalizeProgress } from "@/lib/trainer/cll";
import { ACTIVE_EVENTS } from "@/lib/event-theme";
import { ACTIVITY_BADGES, BADGE_TIERS, checkActivityBadges } from "@/lib/badges";

export interface AnalyticsPayload {
  solvesOverTime: SolvesOverTimeData;
  pbStaircase: PbStaircaseData;
  competitionImprovements: CompetitionImprovement[];
  targetCs: number | null;
}

export type ClientTabDataResult =
  | { tab: "practice"; data: PracticeTabData }
  | { tab: "competitions"; data: CompetitionTabData }
  | { tab: "analytics"; data: AnalyticsTabData }
  | { tab: "badges"; data: BadgesTabData }
  | { tab: "trainer"; data: TrainerTabData };

const TAIL = 160;
type HistoricalRow = {
  id: string;
  time_cs: number;
  penalty: string;
  solved_at: string;
  scramble: string | null;
};

async function events(): Promise<EventRow[]> {
  const { db } = await requireUser();
  const { data, error } = await db
    .from("events")
    .select("id, name, format")
    .in("id", ACTIVE_EVENTS)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as EventRow[];
}

export async function loadClientShell(cuberId: string): Promise<ShellData> {
  const { db, ownerId } = await requireUser();
  const [{ data: cuber, error: cuberError }, eventRows, { data: cubers, error: cubersError }] =
    await Promise.all([
      db.from("cubers").select("name, display_name").eq("id", cuberId).single(),
      events(),
      db.from("cubers").select("id, name, display_name, avatar_color").eq("owner_id", ownerId).order("name"),
    ]);
  if (cuberError) throw cuberError;
  if (cubersError) throw cubersError;
  return {
    cuberName: cuber.display_name ?? cuber.name,
    events: eventRows,
    cubers: (cubers ?? []) as ShellData["cubers"],
  };
}

export async function loadClientSettings() {
  const { db, ownerId } = await requireUser();
  const { data, error } = await db
    .from("app_settings")
    .select("default_cuber_id, current_cuber_id")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function practice(cuberId: string, eventId: string, eventRows: EventRow[]): Promise<PracticeTabData> {
  const { db, ownerId } = await requireUser();
  const [summary, goal] = await Promise.all([
    db.rpc("get_practice_summaries", {
      p_owner_id: ownerId,
      p_cuber_id: cuberId,
      p_event_ids: [eventId],
      p_tail_limit: TAIL,
    }),
    db.from("goals").select("id, target_cs").eq("cuber_id", cuberId).eq("event_id", eventId)
      .eq("record_type", "single").eq("status", "active").maybeSingle(),
  ]);
  for (const result of [summary, goal]) if (result.error) throw result.error;
  const row = (summary.data as Array<{
    ao5: number | null; ao12: number | null; ao50: number | null; ao100: number | null;
    best: number | null; count: number; recent_times: number[];
  }> | null)?.[0];
  return {
    events: eventRows,
    defaultEventId: eventId,
    cuberId,
    activeGoal: goal.data,
    ao5: row?.ao5 ?? null,
    ao12: row?.ao12 ?? null,
    ao50: row?.ao50 ?? null,
    ao100: row?.ao100 ?? null,
    best: row?.best ?? null,
    count: Number(row?.count ?? 0),
    recentTimes: row?.recent_times ?? [],
  };
}

async function currentPbs(cuberId: string): Promise<CurrentPb[]> {
  const { db, ownerId } = await requireUser();
  const { data, error } = await db.rpc("get_current_pbs", {
    p_owner_id: ownerId,
    p_cuber_id: cuberId,
    p_event_ids: ACTIVE_EVENTS,
  });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, string | number | null>>).map((row) => ({
    eventId: String(row.event_id),
    officialSingle: row.official_single as number | null,
    officialAvg: row.official_avg as number | null,
    wcaSingle: row.wca_single as number | null,
    wcaAvg: row.wca_avg as number | null,
    unofficialSingle: row.unofficial_single as number | null,
    unofficialAvg: row.unofficial_avg as number | null,
    practiceSingle: row.practice_single as number | null,
    practiceAo5: row.practice_ao5 as number | null,
    practiceAo12: row.practice_ao12 as number | null,
    practiceAo50: row.practice_ao50 as number | null,
    practiceAo100: row.practice_ao100 as number | null,
    practiceCount: Number(row.practice_count ?? 0),
  }));
}

async function analytics(cuberId: string, eventId: string, eventRows: EventRow[]): Promise<AnalyticsTabData> {
  const { db } = await requireUser();
  const [solvesOverTime, historyResult, goalResult, pbs, cuberResult, pbStaircase, competitionImprovements] = await Promise.all([
    getSolvesOverTime(db, cuberId, eventId),
    db.from("solves").select("id, time_cs, penalty, solved_at, scramble")
      .eq("cuber_id", cuberId).eq("event_id", eventId).eq("context", "practice")
      .order("solved_at", { ascending: false }).limit(100),
    db.from("goals").select("target_cs").eq("cuber_id", cuberId).eq("event_id", eventId)
      .eq("record_type", "single").eq("status", "active").maybeSingle(),
    currentPbs(cuberId),
    db.from("cubers").select("wca_id").eq("id", cuberId).single(),
    getPbStaircase(db, cuberId, eventId),
    getCompetitionImprovements(db, cuberId, eventId),
  ]);
  const payload: AnalyticsPayload = {
    solvesOverTime,
    pbStaircase,
    competitionImprovements,
    targetCs: goalResult.data?.target_cs ?? null,
  };
  return {
    events: eventRows,
    defaultEventId: eventId,
    cuberId,
    initialAnalyticsData: payload,
    pbs,
    wcaId: cuberResult.data?.wca_id ?? null,
    initialSessionTimes: (historyResult.data ?? []).map((row: HistoricalRow) => ({
      id: row.id,
      cs: row.time_cs,
      penalty: row.penalty === "dnf" ? "dnf" : row.penalty === "plus2" ? "plus2" : "none",
      timestamp: new Date(row.solved_at).getTime(),
      scramble: row.scramble,
    })),
  };
}

async function fetchClientTabData(tab: Tab, cuberId: string, eventId: string): Promise<ClientTabDataResult> {
  const { db, ownerId } = await requireUser();
  const eventRows = await events();
  if (tab === "practice") return { tab, data: await practice(cuberId, eventId, eventRows) };
  if (tab === "analytics") return { tab, data: await analytics(cuberId, eventId, eventRows) };
  if (tab === "competitions") {
    const [{ data: competitions, error }, { data: cuber }, { data: results }] = await Promise.all([
      db.from("competitions").select("id, name, type, city, country, start_date, end_date")
        .eq("cuber_id", cuberId).order("start_date", { ascending: false }),
      db.from("cubers").select("wca_id").eq("id", cuberId).single(),
      db.from("results").select("competition_id, event_id").eq("cuber_id", cuberId),
    ]);
    if (error) throw error;
    const byCompetition = new Map<string, Set<string>>();
    for (const row of results ?? []) {
      if (!byCompetition.has(row.competition_id)) byCompetition.set(row.competition_id, new Set());
      byCompetition.get(row.competition_id)!.add(row.event_id);
    }
    return { tab, data: {
      competitions: (competitions ?? []).map((row: {
        id: string; name: string; type: string; city: string | null; country: string | null;
        start_date: string | null; end_date: string | null;
      }) => ({ ...row, eventIds: [...(byCompetition.get(row.id) ?? [])] })),
      cuberId,
      wcaId: cuber?.wca_id ?? null,
    } };
  }
  if (tab === "trainer") {
    const { data, error } = await db.from("trainer_progress")
      .select("progress")
      .eq("cuber_id", cuberId)
      .eq("trainer_key", CLL_TRAINER_KEY)
      .maybeSingle();
    if (error) throw error;
    return { tab, data: { cuberId, progress: normalizeProgress(data?.progress) } };
  }
  const [solveCount, compCount] = await Promise.all([
    db.from("solves").select("id", { count: "exact", head: true }).eq("cuber_id", cuberId).eq("context", "practice"),
    db.from("competitions").select("id", { count: "exact", head: true }).eq("cuber_id", cuberId),
  ]);
  // Competition badges have no unlock of their own on the server (practice
  // badges unlock in record_practice_solve), so catch them up here.
  await checkActivityBadges(db, ownerId, cuberId, { compCount: compCount.count ?? 0 })
    .catch((err) => console.error("Competition badge check failed:", err));
  const { data: achievements } = await db
    .from("achievements").select("badge_key, unlocked_at, metadata").eq("cuber_id", cuberId);
  return { tab, data: {
    achievements: achievements ?? [],
    unlockedCount: achievements?.length ?? 0,
    totalCount: BADGE_TIERS.length + ACTIVITY_BADGES.length,
    pbs: await currentPbs(cuberId),
    solveCount: solveCount.count ?? 0,
    compCount: compCount.count ?? 0,
    streak: 0,
  } as BadgesTabData };
}

export async function getClientTabData(tab: Tab, cuberId: string, eventId: string): Promise<ClientTabDataResult> {
  const { ownerId } = await requireUser();
  const scope = `owner:${ownerId}`;
  const entityId = `${cuberId}:${eventId}:${tab}`;
  try {
    const result = await fetchClientTabData(tab, cuberId, eventId);
    void cacheEntity({ scope, entityType: "tab-data", entityId, value: result });
    return result;
  } catch (error) {
    const cached = await getCachedEntity<ClientTabDataResult>(scope, "tab-data", entityId, {
      includeTombstone: false,
    });
    if (cached?.value) return cached.value;
    throw error;
  }
}
