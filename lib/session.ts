import type { SupabaseClient } from "@supabase/supabase-js";

const SESSION_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours of inactivity → new session

/**
 * Returns the ID of the current open practice session for the given
 * cuber + event, creating a new one if none exists within the inactivity window.
 */
export async function getOrCreateSession(
  db: SupabaseClient,
  ownerId: string,
  cuberId: string,
  eventId: string
): Promise<string> {
  const windowStart = new Date(Date.now() - SESSION_WINDOW_MS).toISOString();

  const { data: session } = await db
    .from("sessions")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("cuber_id", cuberId)
    .eq("event_id", eventId)
    .is("ended_at", null)
    .gt("started_at", windowStart)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (session) return session.id;

  const { data: newSession, error } = await db
    .from("sessions")
    .insert({ owner_id: ownerId, cuber_id: cuberId, event_id: eventId })
    .select("id")
    .single();

  if (error || !newSession) {
    throw new Error(`Failed to create session: ${error?.message}`);
  }
  return newSession.id;
}
