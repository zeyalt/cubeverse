import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Count consecutive days (ending today or yesterday) with ≥1 practice solve.
 * A streak is still live if the most recent solve was yesterday (grace day).
 */
export async function computeStreak(
  db: SupabaseClient,
  cuberId: string
): Promise<number> {
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();

  const { data } = await db
    .from("solves")
    .select("solved_at")
    .eq("cuber_id", cuberId)
    .eq("context", "practice")
    .gte("solved_at", since);

  if (!data?.length) return 0;

  const days = new Set(
    (data as { solved_at: string }[]).map((r) => r.solved_at.slice(0, 10))
  );

  function ymd(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start from today; fall back to yesterday as a grace day
  const startDate = new Date(today);
  if (!days.has(ymd(startDate))) {
    startDate.setDate(startDate.getDate() - 1);
  }
  if (!days.has(ymd(startDate))) return 0;

  let streak = 0;
  const cursor = new Date(startDate);
  while (days.has(ymd(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
