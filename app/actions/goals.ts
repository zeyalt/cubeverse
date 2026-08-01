"use server";

import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { loadPracticeTab } from "@/lib/kid/tabData";

// ── Practice-tab goal helpers ─────────────────────────────────────────────────

export interface PracticeSetupCube {
  id: string;
  name: string;
  brand: string | null;
  event_id: string | null;
}

export async function getPracticeSetupData(
  cuberId: string,
  eventId: string
): Promise<{
  cubes: PracticeSetupCube[];
  activeGoal: { id: string; target_cs: number } | null;
  recentTimes: number[];
  best: number | null;
  count: number;
}> {
  const db = getServiceClient();
  const ownerId = getOwnerId();

  // Delegates to the shared practice loader so the event-switch path and the
  // initial server render can't drift apart. The event list is passed empty
  // because the caller already has it and discards this field.
  const { cubes, activeGoal, recentTimes, best, count } = await loadPracticeTab(
    db,
    ownerId,
    cuberId,
    eventId,
    [],
    null
  );

  return { cubes, activeGoal, recentTimes, best, count };
}

export async function setPracticeGoal(
  cuberId: string,
  eventId: string,
  targetCs: number
): Promise<{ error: string | null }> {
  const db = getServiceClient();
  const ownerId = getOwnerId();

  // Update the existing active goal in place rather than archive-then-insert.
  // The old two-step dance was not atomic: concurrent calls (e.g. rapid +/-
  // taps) could interleave their archive and insert steps and transiently
  // leave more than one row marked active, which is what let the displayed
  // target jump to a stale value. A single row per (cuber, event, single) is
  // updated here instead, so there's only ever one active goal to read back.
  const { data: existing } = await db
    .from("goals")
    .select("id")
    .eq("cuber_id", cuberId)
    .eq("event_id", eventId)
    .eq("record_type", "single")
    .eq("status", "active")
    .maybeSingle();

  if (existing) {
    const { error } = await db
      .from("goals")
      .update({ target_cs: targetCs })
      .eq("id", existing.id);
    return { error: error?.message ?? null };
  }

  const { error } = await db.from("goals").insert({
    owner_id: ownerId,
    cuber_id: cuberId,
    event_id: eventId,
    record_type: "single",
    target_cs: targetCs,
    status: "active",
  });

  return { error: error?.message ?? null };
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
