"use server";

import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { effectiveTime } from "@/lib/cubing";
import type { Penalty } from "@/lib/cubing";

// ── Practice-tab goal helpers ─────────────────────────────────────────────────

export interface PracticeSetupCube {
  id: string;
  name: string;
  event_id: string | null;
}

export async function getPracticeSetupData(
  cuberId: string,
  eventId: string
): Promise<{
  cubes: PracticeSetupCube[];
  activeGoal: { id: string; target_cs: number } | null;
  recentTimes: number[];
}> {
  const db = getServiceClient();

  const [{ data: cubes }, { data: goal }, { data: solves }] = await Promise.all([
    db
      .from("cubes")
      .select("id, name, event_id")
      .eq("cuber_id", cuberId)
      .eq("event_id", eventId)
      .order("is_main", { ascending: false })
      .order("name"),
    db
      .from("goals")
      .select("id, target_cs")
      .eq("cuber_id", cuberId)
      .eq("event_id", eventId)
      .eq("record_type", "single")
      .eq("status", "active")
      .maybeSingle(),
    db
      .from("solves")
      .select("time_cs, penalty")
      .eq("cuber_id", cuberId)
      .eq("event_id", eventId)
      .eq("context", "practice")
      .order("solved_at"),
  ]);

  return {
    cubes: (cubes ?? []) as PracticeSetupCube[],
    activeGoal: goal ? { id: goal.id as string, target_cs: goal.target_cs as number } : null,
    recentTimes: (solves ?? []).map((s) =>
      effectiveTime(s.time_cs as number, s.penalty as Penalty)
    ),
  };
}

export async function setPracticeGoal(
  cuberId: string,
  eventId: string,
  targetCs: number
): Promise<{ error: string | null }> {
  const db = getServiceClient();
  const ownerId = getOwnerId();

  // Archive any existing active single goal for this event
  await db
    .from("goals")
    .update({ status: "archived" })
    .eq("cuber_id", cuberId)
    .eq("event_id", eventId)
    .eq("record_type", "single")
    .eq("status", "active");

  const { error } = await db.from("goals").insert({
    owner_id: ownerId,
    cuber_id: cuberId,
    event_id: eventId,
    record_type: "single",
    target_cs: targetCs,
    status: "active",
  });

  if (error) return { error: error.message };
  return { error: null };
}

export async function clearPracticeGoal(
  cuberId: string,
  eventId: string
): Promise<void> {
  const db = getServiceClient();
  await db
    .from("goals")
    .update({ status: "archived" })
    .eq("cuber_id", cuberId)
    .eq("event_id", eventId)
    .eq("record_type", "single")
    .eq("status", "active");
}
