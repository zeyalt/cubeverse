import { effectiveTime, aoN, DNF, type Penalty } from "@/lib/cubing";
import { requireUser } from "@/lib/supabase/auth";
import { getClientTabData } from "./tabData";
import type { CllTrainerProgress } from "@/lib/trainer/cll";

export type FormState = { error: string | null; redirectTo?: string };
export type ImportState = { error: string | null; compsImported?: number; resultsImported?: number };

export interface SolveInput {
  cuberId: string;
  eventId: string;
  timeCs: number;
  penalty: "none" | "plus2" | "dnf";
  scramble: string | null;
  cubeId?: string;
  idempotencyId?: string;
}

export interface SessionStats {
  sessionId: string;
  solveId: string | null;
  count: number;
  bestCs: number | null;
  ao5: number | null;
  ao12: number | null;
  isPb: boolean;
  newBadges: string[];
  error?: string | null;
}

export interface HistoricalSolve {
  id: string;
  cs: number;
  penalty: "none" | "plus2" | "dnf";
  timestamp: number;
  scramble: string | null;
}

export interface CompetitionNote {
  id: string;
  competitionId: string;
  eventId: string | null;
  roundType: string | null;
  content: string;
  updatedAt: string;
}

async function wca<T>(resource: "person" | "results" | "competition", id: string): Promise<T> {
  const { db } = await requireUser();
  const { data: session } = await db.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error("Authentication required");
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const response = await fetch(
    `${base}/functions/v1/wca-proxy?resource=${resource}&id=${encodeURIComponent(id)}`,
    { headers: { authorization: `Bearer ${token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! } }
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `WCA request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function fetchWcaPerson(id: string) {
  return wca<{ name?: string; country?: { name?: string } }>("person", id.trim().toUpperCase());
}

export async function recordSolve(input: SolveInput): Promise<SessionStats> {
  try {
    const { db, ownerId } = await requireUser();
    const { data, error } = await db.rpc("record_practice_solve", {
      p_owner_id: ownerId,
      p_cuber_id: input.cuberId,
      p_event_id: input.eventId,
      p_time_cs: input.timeCs,
      p_penalty: input.penalty,
      p_scramble: input.scramble,
      p_cube_id: input.cubeId ?? null,
      p_idempotency_key: input.idempotencyId ?? crypto.randomUUID(),
    });
    if (error) throw error;
    return data as SessionStats;
  } catch (cause) {
    return {
      sessionId: "", solveId: null, count: 0, bestCs: null, ao5: null, ao12: null,
      isPb: false, newBadges: [], error: cause instanceof Error ? cause.message : "Save failed",
    };
  }
}

export async function updateSolve(id: string, timeCs: number, penalty: "none" | "plus2" | "dnf") {
  const { db, ownerId } = await requireUser();
  const { error } = await db.from("solves").update({ time_cs: timeCs, penalty }).eq("id", id).eq("owner_id", ownerId);
  if (error) throw error;
}

export async function deleteSolve(id: string) {
  const { db, ownerId } = await requireUser();
  const { error } = await db.from("solves").delete().eq("id", id).eq("owner_id", ownerId);
  if (error) throw error;
}

export async function getHistoricalSolves(cuberId: string, eventId: string, offset = 0, limit = 100): Promise<HistoricalSolve[]> {
  const { db } = await requireUser();
  const { data, error } = await db.from("solves").select("id, time_cs, penalty, solved_at, scramble")
    .eq("cuber_id", cuberId).eq("event_id", eventId).eq("context", "practice")
    .order("solved_at", { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []).map((row: {
    id: string; time_cs: number; penalty: string; solved_at: string; scramble: string | null;
  }) => ({
    id: row.id, cs: row.time_cs,
    penalty: row.penalty === "dnf" ? "dnf" : row.penalty === "plus2" ? "plus2" : "none",
    timestamp: new Date(row.solved_at).getTime(), scramble: row.scramble,
  }));
}

export async function getPracticeSetupData(cuberId: string, eventId: string) {
  const result = await getClientTabData("practice", cuberId, eventId);
  if (result.tab !== "practice") throw new Error("Practice data unavailable");
  return {
    activeGoal: result.data.activeGoal,
    recentTimes: result.data.recentTimes,
    best: result.data.best,
    count: result.data.count,
  };
}

export async function setPracticeGoal(cuberId: string, eventId: string, targetCs: number) {
  const { db, ownerId } = await requireUser();
  const { data: existing } = await db.from("goals").select("id").eq("cuber_id", cuberId)
    .eq("event_id", eventId).eq("record_type", "single").eq("status", "active").maybeSingle();
  const operation = existing
    ? db.from("goals").update({ target_cs: targetCs }).eq("id", existing.id).eq("owner_id", ownerId)
    : db.from("goals").insert({ owner_id: ownerId, cuber_id: cuberId, event_id: eventId, record_type: "single", target_cs: targetCs });
  const { error } = await operation;
  return { error: error?.message ?? null };
}

export async function completeOnboarding(input: { name: string; wcaId: string | null; avatarColor: string }): Promise<FormState> {
  try {
    const { db, ownerId } = await requireUser();
    const { count } = await db.from("cubers").select("id", { count: "exact", head: true }).eq("owner_id", ownerId);
    if ((count ?? 0) >= 4) return { error: "Maximum 4 cubers per account." };
    const created = await db.from("cubers").insert({
      owner_id: ownerId,
      name: input.name.trim(),
      display_name: input.name.trim(),
      wca_id: input.wcaId,
      avatar_color: input.avatarColor,
    }).select("id").single();
    if (created.error) return { error: created.error.message };
    const first = (count ?? 0) === 0;
    const { error } = await db.from("app_settings").upsert({
      owner_id: ownerId,
      current_cuber_id: created.data.id,
      ...(first ? { default_cuber_id: created.data.id } : {}),
    });
    return error ? { error: error.message } : { error: null, redirectTo: "/" };
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : "Setup failed" };
  }
}

export async function switchCuberInPlace(cuberId: string) {
  const { db, ownerId } = await requireUser();
  const { error } = await db.from("app_settings").update({ current_cuber_id: cuberId }).eq("owner_id", ownerId);
  return { error: error?.message ?? null };
}

export async function deleteCuber(cuberId: string) {
  const { db, ownerId } = await requireUser();
  const { data: cubers } = await db.from("cubers").select("id").eq("owner_id", ownerId);
  if (!cubers || cubers.length <= 1) return { error: "You can't delete your only cuber." };
  const fallback = cubers.find((row: { id: string }) => row.id !== cuberId)!.id;
  const { error } = await db.from("cubers").delete().eq("id", cuberId).eq("owner_id", ownerId);
  if (!error) await db.from("app_settings")
    .update({ current_cuber_id: fallback, default_cuber_id: fallback }).eq("owner_id", ownerId);
  return { error: error?.message ?? null };
}

export async function saveTrainerProgress(
  cuberId: string,
  trainerKey: string,
  progress: CllTrainerProgress
) {
  try {
    const { db, ownerId } = await requireUser();
    const { error } = await db.from("trainer_progress").upsert(
      {
        owner_id: ownerId,
        cuber_id: cuberId,
        trainer_key: trainerKey,
        progress,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cuber_id,trainer_key" }
    );
    return { error: error?.message ?? null };
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : "Could not save trainer progress" };
  }
}

export async function createCompetition(_previous: FormState, formData: FormData): Promise<FormState> {
  const { db, ownerId } = await requireUser();
  const { error } = await db.from("competitions").insert({
    owner_id: ownerId,
    cuber_id: String(formData.get("cuber_id")),
    name: String(formData.get("name") ?? "").trim(),
    type: "unofficial",
    city: String(formData.get("city") ?? "").trim() || null,
    country: String(formData.get("country") ?? "").trim() || null,
    start_date: String(formData.get("start_date") ?? "") || null,
    end_date: String(formData.get("end_date") ?? "") || null,
    source: "manual",
  });
  if (!error && typeof window !== "undefined") window.location.assign("/?tab=competitions");
  return { error: error?.message ?? null };
}

function parseTime(value: string): number | null {
  const parts = value.trim().split(":");
  const seconds = Number(parts.pop());
  const minutes = parts.length ? Number(parts.pop()) : 0;
  if (!Number.isFinite(seconds) || !Number.isFinite(minutes)) return null;
  return Math.round((minutes * 60 + seconds) * 100);
}

export async function addResultKid(_previous: FormState, formData: FormData): Promise<FormState> {
  const competitionId = String(formData.get("competition_id") ?? "");
  const eventId = String(formData.get("event_id") ?? "");
  const roundType = String(formData.get("round_type") ?? "final");
  const solves: Array<{ time_cs: number; penalty: string }> = [];
  for (let index = 1; index <= 5; index++) {
    const penalty = String(formData.get(`penalty_${index}`) ?? "none");
    const raw = String(formData.get(`time_${index}`) ?? "").trim();
    if (!raw && penalty === "none") continue;
    const parsed = penalty === "dnf" || penalty === "dns" ? 0 : parseTime(raw);
    if (parsed === null) return { error: `"${raw}" is not a valid time.` };
    solves.push({ time_cs: parsed, penalty });
  }
  if (!competitionId || !eventId || !solves.length) return { error: "Enter at least one solve." };
  const { db, ownerId } = await requireUser();
  const [{ data: settings }, { data: event }] = await Promise.all([
    db.from("app_settings").select("current_cuber_id, default_cuber_id").eq("owner_id", ownerId).single(),
    db.from("events").select("format").eq("id", eventId).single(),
  ]);
  const cuberId = settings?.current_cuber_id ?? settings?.default_cuber_id;
  if (!cuberId || !event) return { error: "Cuber or event unavailable." };
  const times = solves.map((solve) => effectiveTime(solve.time_cs, solve.penalty as Penalty));
  const valid = times.filter((time) => time !== DNF);
  const result = await db.from("results").insert({
    owner_id: ownerId, cuber_id: cuberId, competition_id: competitionId,
    event_id: eventId, round_type: roundType, format: event.format,
    best_cs: valid.length ? Math.min(...valid) : DNF,
    average_cs: solves.length === 5 || solves.length === 3 ? aoN(times) : null,
    source: "manual",
  }).select("id").single();
  if (result.error) return { error: result.error.message };
  const { error } = await db.from("solves").insert(solves.map((solve, index) => ({
    ...solve, owner_id: ownerId, cuber_id: cuberId, event_id: eventId,
    context: "competition", result_id: result.data.id, competition_id: competitionId,
    position: index + 1, source: "manual",
  })));
  if (!error && typeof window !== "undefined") window.location.reload();
  return { error: error?.message ?? null };
}

export async function deleteResultKid(formData: FormData) {
  const { db, ownerId } = await requireUser();
  const { error } = await db.from("results").delete()
    .eq("id", String(formData.get("result_id"))).eq("owner_id", ownerId);
  if (error) throw error;
  if (typeof window !== "undefined") window.location.reload();
}

export async function deleteCompetition(formData: FormData) {
  const { db, ownerId } = await requireUser();
  const { error } = await db.from("competitions").delete()
    .eq("id", String(formData.get("competition_id"))).eq("owner_id", ownerId).eq("type", "unofficial");
  if (error) throw error;
  if (typeof window !== "undefined") window.location.assign("/?tab=competitions");
}

type WcaResult = {
  competition_id: string; event_id: string; round_type_id: string; format_id: string;
  best: number; average: number; attempts: number[]; pos: number;
};
type WcaCompetition = {
  id: string; name: string; city: string | null; country_iso2: string | null;
  start_date: string | null; end_date: string | null;
};

export async function importWcaResultsKid(cuberId: string, wcaId: string): Promise<ImportState> {
  try {
    const { db, ownerId } = await requireUser();
    const results = await wca<WcaResult[]>("results", wcaId);
    const ids = [...new Set(results.map((row) => row.competition_id))];
    let compsImported = 0;
    let resultsImported = 0;
    for (const id of ids) {
      const competition = await wca<WcaCompetition>("competition", id);
      const saved = await db.from("competitions").upsert({
        owner_id: ownerId, cuber_id: cuberId, name: competition.name, type: "wca",
        wca_competition_id: competition.id, city: competition.city, country: competition.country_iso2,
        start_date: competition.start_date, end_date: competition.end_date, source: "wca_import",
      }, { onConflict: "cuber_id,wca_competition_id" }).select("id").single();
      if (saved.error) continue;
      compsImported++;
      for (const row of results.filter((result) => result.competition_id === id)) {
        const roundType =
          row.round_type_id === "f" || row.round_type_id === "d"
            ? "final"
            : row.round_type_id === "2" || row.round_type_id === "e"
              ? "second"
              : row.round_type_id === "3"
                ? "semi"
                : "first";
        const format =
          row.format_id === "m" ? "mo3" : row.format_id === "b" ? "bo3" : row.format_id === "1" ? "bo1" : "ao5";
        const existing = await db.from("results").select("id")
          .eq("competition_id", saved.data.id).eq("event_id", row.event_id).eq("round_type", roundType).maybeSingle();
        const values = {
          owner_id: ownerId, cuber_id: cuberId, competition_id: saved.data.id, event_id: row.event_id,
          round_type: roundType, format, best_cs: row.best > 0 ? row.best : -1,
          average_cs: row.average === 0 ? null : row.average, ranking: row.pos, source: "wca_import",
        };
        const stored = existing.data
          ? await db.from("results").update(values).eq("id", existing.data.id).select("id").single()
          : await db.from("results").insert(values).select("id").single();
        if (stored.error) continue;
        if (!existing.data) resultsImported++;
        const { count } = await db.from("solves").select("id", { count: "exact", head: true })
          .eq("result_id", stored.data.id);
        if (!count) {
          const attempts = [...row.attempts];
          while (attempts.at(-1) === 0) attempts.pop();
          if (attempts.length) {
            await db.from("solves").insert(attempts.map((attempt, index) => ({
              owner_id: ownerId, cuber_id: cuberId, event_id: row.event_id,
              context: "competition", result_id: stored.data.id, competition_id: saved.data.id,
              time_cs: attempt > 0 ? attempt : 0,
              penalty: attempt === -1 ? "dnf" : attempt === 0 ? "dns" : "none",
              position: index + 1, source: "wca_import",
            })));
          }
        }
      }
    }
    return { error: null, compsImported, resultsImported };
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : "Import failed" };
  }
}

export interface SavedCompetitor {
  id: string;
  wcaId: string;
  name: string;
  alias: string | null;
}

export interface BenchmarkPoint {
  ts: number;
  date: string;
  compName: string;
  bestCs: number;
  averageCs: number | null;
}

export interface BenchmarkPerson {
  wcaId: string;
  name: string;
  isMe: boolean;
  points: BenchmarkPoint[];
  error: string | null;
}

export async function listBenchmarkCompetitors(cuberId: string): Promise<SavedCompetitor[]> {
  const { db } = await requireUser();
  const { data } = await db.from("benchmark_competitors").select("id, wca_id, name, alias")
    .eq("cuber_id", cuberId).order("created_at");
  return (data ?? []).map((row: { id: string; wca_id: string; name: string; alias: string | null }) => ({
    id: row.id, wcaId: row.wca_id, name: row.name, alias: row.alias,
  }));
}

export async function addBenchmarkCompetitor(cuberId: string, rawId: string) {
  const wcaId = rawId.trim().toUpperCase();
  if (!/^\d{4}[A-Z]{4}\d{2}$/.test(wcaId)) return { error: "Invalid WCA ID.", competitor: null };
  try {
    const person = await wca<{ name?: string }>("person", wcaId);
    const { db, ownerId } = await requireUser();
    const { data, error } = await db.from("benchmark_competitors").upsert({
      owner_id: ownerId, cuber_id: cuberId, wca_id: wcaId, name: person.name ?? wcaId,
    }, { onConflict: "cuber_id,wca_id" }).select("id, wca_id, name, alias").single();
    return error || !data ? { error: error?.message ?? "Could not add competitor.", competitor: null } : {
      error: null, competitor: { id: data.id, wcaId: data.wca_id, name: data.name, alias: data.alias },
    };
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : "Could not add competitor.", competitor: null };
  }
}

export async function updateBenchmarkCompetitorAlias(id: string, rawAlias: string) {
  const alias = rawAlias.trim().slice(0, 24) || null;
  const { db, ownerId } = await requireUser();
  const { data, error } = await db.from("benchmark_competitors").update({ alias })
    .eq("id", id).eq("owner_id", ownerId).select("id, wca_id, name, alias").single();
  return error || !data ? { error: error?.message ?? "Could not save alias.", competitor: null } : {
    error: null, competitor: { id: data.id, wcaId: data.wca_id, name: data.name, alias: data.alias },
  };
}

export async function removeBenchmarkCompetitor(id: string) {
  const { db, ownerId } = await requireUser();
  const { error } = await db.from("benchmark_competitors").delete().eq("id", id).eq("owner_id", ownerId);
  return { error: error?.message ?? null };
}

export async function getBenchmarkSeries(
  myWcaId: string,
  otherWcaIds: string[],
  eventId: string,
  cuberId: string
): Promise<{ error: string | null; people: BenchmarkPerson[] }> {
  if (!myWcaId) return { error: "Set your own WCA ID first.", people: [] };
  const ids = [myWcaId, ...new Set(otherWcaIds.filter((id) => id !== myWcaId))];
  const saved = await listBenchmarkCompetitors(cuberId);
  const people = await Promise.all(ids.map(async (id, personIndex): Promise<BenchmarkPerson> => {
    try {
      const results = (await wca<WcaResult[]>("results", id)).filter((row) => row.event_id === eventId);
      const latestByCompetition = new Map<string, WcaResult>();
      for (const result of results) latestByCompetition.set(result.competition_id, result);
      const points = (await Promise.all([...latestByCompetition.entries()].map(async ([competitionId, result]) => {
        const competition = await wca<WcaCompetition>("competition", competitionId);
        if (!competition.start_date) return null;
        return {
          ts: new Date(competition.start_date).getTime(),
          date: competition.start_date,
          compName: competition.name,
          bestCs: result.best > 0 ? result.best : DNF,
          averageCs: result.average > 0 ? result.average : null,
        };
      }))).filter((point): point is BenchmarkPoint => point !== null).sort((a, b) => a.ts - b.ts);
      const known = saved.find((row) => row.wcaId === id);
      return { wcaId: id, name: personIndex === 0 ? "You" : known?.alias ?? known?.name ?? id, isMe: personIndex === 0, points, error: null };
    } catch (cause) {
      return { wcaId: id, name: id, isMe: personIndex === 0, points: [], error: cause instanceof Error ? cause.message : "WCA request failed" };
    }
  }));
  return { error: null, people };
}

export async function getCompetitionNotes(cuberId: string, competitionId: string): Promise<CompetitionNote[]> {
  const { db } = await requireUser();
  const { data, error } = await db.from("competition_notes")
    .select("id, competition_id, event_id, round_type, content, updated_at")
    .eq("cuber_id", cuberId).eq("competition_id", competitionId).order("event_id").order("round_type");
  if (error) throw error;
  return (data ?? []).map((row: {
    id: string; competition_id: string; event_id: string | null; round_type: string | null;
    content: string | null; updated_at: string;
  }) => ({
    id: row.id,
    competitionId: row.competition_id,
    eventId: row.event_id,
    roundType: row.round_type,
    content: row.content ?? "",
    updatedAt: row.updated_at,
  }));
}

export async function saveCompetitionNote(
  cuberId: string,
  competitionId: string,
  eventId: string | null,
  roundType: string | null,
  content: string
) {
  const { db, ownerId } = await requireUser();
  const { error } = await db.from("competition_notes").upsert({
    owner_id: ownerId,
    cuber_id: cuberId,
    competition_id: competitionId,
    event_id: eventId,
    round_type: roundType,
    content: content || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "cuber_id,competition_id,event_id,round_type" });
  return error ? { success: false, error: error.message } : { success: true };
}

export { getClientTabData as getTabData };
