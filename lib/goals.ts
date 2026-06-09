import type { SupabaseClient } from "@supabase/supabase-js";

export type GoalRecordType = "single" | "average";

/**
 * Mark any active goals as achieved if the new time beats their target.
 * Called after a PB is confirmed (practice or official).
 */
export async function checkAndAchieveGoals(
  db: SupabaseClient,
  cuberId: string,
  eventId: string,
  recordType: GoalRecordType,
  timeCs: number
): Promise<string[]> {
  if (timeCs <= 0) return [];

  const { data: goals } = await db
    .from("goals")
    .select("id, target_cs")
    .eq("cuber_id", cuberId)
    .eq("event_id", eventId)
    .eq("record_type", recordType)
    .eq("status", "active");

  const toAchieve = (goals ?? []).filter(
    (g) => timeCs <= (g.target_cs as number)
  );

  if (!toAchieve.length) return [];

  await db
    .from("goals")
    .update({ status: "achieved", achieved_at: new Date().toISOString() })
    .in(
      "id",
      toAchieve.map((g) => g.id)
    );

  return toAchieve.map((g) => g.id as string);
}

/**
 * Compute progress percentage (0–100) toward a goal.
 * Uses a dynamic upper bound (150% of target) so the bar starts filling once
 * the cuber is within 50% of the target.
 */
export function goalProgress(
  currentCs: number | null,
  targetCs: number
): number {
  if (!currentCs || currentCs <= 0) return 0;
  if (currentCs <= targetCs) return 100;
  const upper = targetCs * 1.5;
  if (currentCs >= upper) return 0;
  return Math.round(((upper - currentCs) / (upper - targetCs)) * 100);
}
