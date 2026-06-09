"use server";

import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";

export type FormState = { error: string | null; success?: string };

export async function deleteSolveFromHistory(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const solveId = formData.get("solve_id") as string;
  const eventId = formData.get("event_id") as string;

  if (!solveId) return { error: "Solve ID is required." };

  const db = getServiceClient();

  const { error } = await db.from("solves").delete().eq("id", solveId);

  if (error) return { error: error.message };

  // Revalidate the event page and history
  revalidatePath(`/parent/event/${eventId}`);
  revalidatePath(`/parent/event/${eventId}/history`);

  return { error: null, success: "Solve deleted." };
}

export interface SolveRow {
  id: string;
  time_cs: number;
  penalty: "none" | "plus2" | "dnf" | "dns";
  scramble: string | null;
  solved_at: string;
  session_id: string | null;
}

export async function fetchSolveHistory(
  eventId: string,
  limit: number = 100,
  offset: number = 0
): Promise<SolveRow[]> {
  const db = getServiceClient();
  const ownerId = getOwnerId();

  const { data: settings } = await db
    .from("app_settings")
    .select("default_cuber_id")
    .eq("owner_id", ownerId)
    .single();

  if (!settings) return [];

  const { data } = await db
    .from("solves")
    .select("id, time_cs, penalty, scramble, solved_at, session_id")
    .eq("cuber_id", settings.default_cuber_id as string)
    .eq("event_id", eventId)
    .eq("context", "practice")
    .order("solved_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return (data ?? []) as SolveRow[];
}

export async function getSolveCount(eventId: string): Promise<number> {
  const db = getServiceClient();
  const ownerId = getOwnerId();

  const { data: settings } = await db
    .from("app_settings")
    .select("default_cuber_id")
    .eq("owner_id", ownerId)
    .single();

  if (!settings) return 0;

  const { count } = await db
    .from("solves")
    .select("id", { count: "exact", head: true })
    .eq("cuber_id", settings.default_cuber_id as string)
    .eq("event_id", eventId)
    .eq("context", "practice");

  return count ?? 0;
}
