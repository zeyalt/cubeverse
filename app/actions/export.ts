"use server";

import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";

export interface ExportData {
  exported_at: string;
  cuber: {
    id: string;
    name: string;
    display_name: string | null;
  };
  competitions: Array<{
    id: string;
    name: string;
    type: string;
    city: string | null;
    country: string | null;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
  }>;
  results: Array<{
    id: string;
    competition_id: string;
    event_id: string;
    round_type: string;
    format: string;
    best_cs: number;
    average_cs: number | null;
  }>;
  solves: Array<{
    id: string;
    event_id: string;
    context: string;
    time_cs: number;
    penalty: string;
    position: number | null;
    solved_at: string;
  }>;
  pbs: Array<{
    event_id: string;
    record_type: string;
    context: string;
    time_cs: number;
    achieved_at: string;
  }>;
  goals: Array<{
    id: string;
    event_id: string;
    record_type: string;
    target_cs: number;
    status: string;
    achieved_at: string | null;
  }>;
  achievements: Array<{
    badge_key: string;
    unlocked_at: string;
  }>;
  cubes: Array<{
    id: string;
    type: string;
    brand: string | null;
    model: string | null;
    acquired_date: string | null;
    notes: string | null;
  }>;
  journal_entries: Array<{
    id: string;
    title: string;
    content: string;
    event_id: string | null;
    created_at: string;
  }>;
}

export async function exportAllData(): Promise<ExportData | null> {
  const db = getServiceClient();
  const ownerId = getOwnerId();

  const { data: settings } = await db
    .from("app_settings")
    .select("default_cuber_id")
    .eq("owner_id", ownerId)
    .single();

  if (!settings) return null;
  const cuberId = settings.default_cuber_id as string;

  const [
    { data: cuber },
    { data: competitions },
    { data: results },
    { data: solves },
    { data: pbs },
    { data: goals },
    { data: achievements },
    { data: cubes },
    { data: journal },
  ] = await Promise.all([
    db.from("cubers").select("*").eq("id", cuberId).single(),
    db
      .from("competitions")
      .select("*")
      .eq("cuber_id", cuberId)
      .order("start_date", { ascending: false }),
    db.from("results").select("*").eq("cuber_id", cuberId),
    db.from("solves").select("*").eq("cuber_id", cuberId),
    db
      .from("pb_history")
      .select("event_id, record_type, context, time_cs, achieved_at")
      .eq("cuber_id", cuberId),
    db
      .from("goals")
      .select("*")
      .eq("cuber_id", cuberId)
      .neq("status", "archived"),
    db
      .from("achievements")
      .select("badge_key, unlocked_at")
      .eq("cuber_id", cuberId)
      .order("unlocked_at", { ascending: false }),
    db.from("cubes").select("*").eq("cuber_id", cuberId),
    db.from("journal_entries").select("*").eq("cuber_id", cuberId),
  ]);

  return {
    exported_at: new Date().toISOString(),
    cuber: {
      id: (cuber?.id as string) ?? cuberId,
      name: (cuber?.name as string) ?? "Unknown",
      display_name: (cuber?.display_name as string | null) ?? null,
    },
    competitions: (competitions ?? []) as ExportData["competitions"],
    results: (results ?? []) as ExportData["results"],
    solves: (solves ?? []) as ExportData["solves"],
    pbs: (pbs ?? []) as ExportData["pbs"],
    goals: (goals ?? []) as ExportData["goals"],
    achievements: (achievements ?? []) as ExportData["achievements"],
    cubes: (cubes ?? []) as ExportData["cubes"],
    journal_entries: (journal ?? []) as ExportData["journal_entries"],
  };
}
