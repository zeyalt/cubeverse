"use server";

import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { parseToCs } from "@/lib/cubing";
import { STARTER_GOALS } from "@/lib/goals-seed";
import type { GoalRecordType } from "@/lib/goals";

// ── Practice-tab goal helpers ─────────────────────────────────────────────────

export interface PracticeSetupCube {
  id: string;
  name: string;
  event_id: string | null;
}

export async function getPracticeSetupData(
  cuberId: string,
  eventId: string
): Promise<{ cubes: PracticeSetupCube[]; activeGoal: { id: string; target_cs: number } | null }> {
  const db = getServiceClient();

  const [{ data: cubes }, { data: goal }] = await Promise.all([
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
  ]);

  return {
    cubes: (cubes ?? []) as PracticeSetupCube[],
    activeGoal: goal ? { id: goal.id as string, target_cs: goal.target_cs as number } : null,
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

export type FormState = { error: string | null; success?: string };

async function getDefaultCuberId(db: ReturnType<typeof getServiceClient>, ownerId: string) {
  const { data } = await db
    .from("app_settings")
    .select("default_cuber_id")
    .eq("owner_id", ownerId)
    .single();
  return data?.default_cuber_id as string | null;
}

export async function createGoal(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const eventId = formData.get("event_id") as string;
  const recordType = formData.get("record_type") as GoalRecordType;
  const targetStr = (formData.get("target") as string)?.trim();
  const targetDate = (formData.get("target_date") as string) || null;

  if (!eventId || !recordType || !targetStr) {
    return { error: "Event, type, and target time are required." };
  }

  const targetCs = parseToCs(targetStr);
  if (targetCs <= 0) return { error: "Target must be a valid time (not DNF)." };

  const db = getServiceClient();
  const ownerId = getOwnerId();
  const cuberId = await getDefaultCuberId(db, ownerId);
  if (!cuberId) return { error: "No cuber set up." };

  const { error } = await db.from("goals").insert({
    owner_id: ownerId,
    cuber_id: cuberId,
    event_id: eventId,
    record_type: recordType,
    target_cs: targetCs,
    target_date: targetDate,
    status: "active",
  });

  if (error) return { error: error.message };

  revalidatePath("/");
  return { error: null, success: "Goal created." };
}

export async function seedStarterGoals(): Promise<FormState> {
  const db = getServiceClient();
  const ownerId = getOwnerId();
  const cuberId = await getDefaultCuberId(db, ownerId);
  if (!cuberId) return { error: "No cuber set up." };

  const { count } = await db
    .from("goals")
    .select("id", { count: "exact", head: true })
    .eq("cuber_id", cuberId);

  if (count && count > 0) {
    return { error: "Goals already exist — delete or archive them first." };
  }

  const rows = STARTER_GOALS.map((g) => ({
    owner_id: ownerId,
    cuber_id: cuberId,
    event_id: g.eventId,
    record_type: g.recordType,
    target_cs: g.targetCs,
    status: "active",
  }));

  const { error } = await db.from("goals").insert(rows);
  if (error) return { error: error.message };

  revalidatePath("/");
  return { error: null, success: `Added ${rows.length} starter goals.` };
}

export async function archiveGoal(goalId: string): Promise<void> {
  const db = getServiceClient();
  await db.from("goals").update({ status: "archived" }).eq("id", goalId);
  revalidatePath("/");
}
