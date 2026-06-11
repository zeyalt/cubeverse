import type { SupabaseClient } from "@supabase/supabase-js";

export interface ParsedSolve {
  event_id: string;
  time_cs: number;
  penalty: "none" | "plus2" | "dnf" | "dns";
  scramble?: string;
  solved_at?: string; // ISO date; defaults to now
  comment?: string;
}

const SESSION_WINDOW_MS = 2 * 60 * 60 * 1000; // 2-hour inactivity window

/**
 * Shared ingest path for both the in-app timer (single solve) and bulk importers.
 *
 * For bulk imports: groups solves into sessions by the 2-hour inactivity window,
 * creates sessions in bulk, then inserts all solves in a single batch — avoiding
 * hundreds of sequential DB round trips.
 *
 * Returns the IDs of the inserted solves.
 */
export async function ingestPracticeSolves(
  db: SupabaseClient,
  ownerId: string,
  cuberId: string,
  solves: ParsedSolve[],
  source: "manual" | "twisty_import" = "manual"
): Promise<string[]> {
  if (solves.length === 0) return [];

  // Single-solve fast path (in-app timer) — preserves original behaviour
  if (solves.length === 1) {
    return ingestSingle(db, ownerId, cuberId, solves[0], source);
  }

  // ── Bulk path ──────────────────────────────────────────────────────────────
  // Sort ascending by solve time so session windows are correct
  const sorted = [...solves].sort((a, b) => {
    const ta = a.solved_at ? new Date(a.solved_at).getTime() : 0;
    const tb = b.solved_at ? new Date(b.solved_at).getTime() : 0;
    return ta - tb;
  });

  // Group into sessions by event + 2-hour inactivity window
  type SessionGroup = { eventId: string; solves: ParsedSolve[]; startedAt: string };
  const groups: SessionGroup[] = [];

  for (const solve of sorted) {
    const ts = solve.solved_at ? new Date(solve.solved_at).getTime() : Date.now();
    const last = groups[groups.length - 1];

    const lastTs = last?.solves[last.solves.length - 1]?.solved_at
      ? new Date(last.solves[last.solves.length - 1].solved_at!).getTime()
      : 0;

    if (last && last.eventId === solve.event_id && ts - lastTs <= SESSION_WINDOW_MS) {
      last.solves.push(solve);
    } else {
      groups.push({
        eventId: solve.event_id,
        solves: [solve],
        startedAt: solve.solved_at ?? new Date().toISOString(),
      });
    }
  }

  // Create all sessions in one batch insert
  const { data: sessions, error: sessErr } = await db
    .from("sessions")
    .insert(
      groups.map((g) => ({
        owner_id: ownerId,
        cuber_id: cuberId,
        event_id: g.eventId,
        started_at: g.startedAt,
      }))
    )
    .select("id");

  if (sessErr || !sessions) throw new Error(`Failed to create sessions: ${sessErr?.message}`);

  // Build solve rows with session IDs and positions
  const solveRows: object[] = [];
  for (let i = 0; i < groups.length; i++) {
    const sessionId = sessions[i].id;
    groups[i].solves.forEach((solve, pos) => {
      solveRows.push({
        owner_id: ownerId,
        cuber_id: cuberId,
        event_id: solve.event_id,
        context: "practice",
        session_id: sessionId,
        time_cs: solve.time_cs,
        penalty: solve.penalty,
        scramble: solve.scramble ?? null,
        comment: solve.comment ?? null,
        position: pos + 1,
        solved_at: solve.solved_at ?? new Date().toISOString(),
        source,
      });
    });
  }

  // Upsert all solves in chunks — duplicates (same cuber+event+solved_at+time_cs) are ignored
  const CHUNK = 500;
  const insertedIds: string[] = [];
  for (let i = 0; i < solveRows.length; i += CHUNK) {
    const { data, error } = await db
      .from("solves")
      .upsert(solveRows.slice(i, i + CHUNK), {
        onConflict: "cuber_id,event_id,solved_at,time_cs",
        ignoreDuplicates: true,
      })
      .select("id");
    if (!error && data) insertedIds.push(...data.map((r: any) => r.id));
  }

  return insertedIds;
}

async function ingestSingle(
  db: SupabaseClient,
  ownerId: string,
  cuberId: string,
  solve: ParsedSolve,
  source: "manual" | "twisty_import"
): Promise<string[]> {
  const windowStart = new Date(Date.now() - SESSION_WINDOW_MS).toISOString();

  const { data: session } = await db
    .from("sessions")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("cuber_id", cuberId)
    .eq("event_id", solve.event_id)
    .is("ended_at", null)
    .gt("started_at", windowStart)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let sessionId: string;
  if (session) {
    sessionId = session.id;
  } else {
    const { data: newSession, error } = await db
      .from("sessions")
      .insert({ owner_id: ownerId, cuber_id: cuberId, event_id: solve.event_id })
      .select("id")
      .single();
    if (error || !newSession) throw new Error(`Failed to create session: ${error?.message}`);
    sessionId = newSession.id;
  }

  const { count: existingCount } = await db
    .from("solves")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  const { data, error } = await db
    .from("solves")
    .insert({
      owner_id: ownerId,
      cuber_id: cuberId,
      event_id: solve.event_id,
      context: "practice",
      session_id: sessionId,
      time_cs: solve.time_cs,
      penalty: solve.penalty,
      scramble: solve.scramble ?? null,
      comment: solve.comment ?? null,
      position: (existingCount ?? 0) + 1,
      solved_at: solve.solved_at ?? new Date().toISOString(),
      source,
    })
    .select("id")
    .single();

  return data ? [data.id] : [];
}
