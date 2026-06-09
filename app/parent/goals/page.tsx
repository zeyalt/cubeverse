import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { getCurrentPb } from "@/lib/pb";
import { GoalsView } from "@/components/goals/GoalsView";
import { PageHeader } from "@/components/parent/PageHeader";

export default async function GoalsPage() {
  const db = getServiceClient();
  const ownerId = getOwnerId();

  const { data: settings } = await db
    .from("app_settings")
    .select("default_cuber_id")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!settings) {
    return <p className="text-zinc-400 text-sm">Run setup first.</p>;
  }

  const cuberId = settings.default_cuber_id as string;

  const [{ data: goals }, { data: events }] = await Promise.all([
    db
      .from("goals")
      .select("id, event_id, record_type, target_cs, target_date, status, achieved_at")
      .eq("cuber_id", cuberId)
      .neq("status", "archived")
      .order("status")
      .order("created_at"),
    db
      .from("events")
      .select("id, name")
      .gte("sort_order", 1)
      .lte("sort_order", 7)
      .order("sort_order"),
  ]);

  const eventNames = Object.fromEntries(
    (events ?? []).map((e) => [e.id as string, e.name as string])
  );

  const enriched = await Promise.all(
    (goals ?? []).map(async (g) => {
      const currentCs = await getCurrentPb(
        db,
        cuberId,
        g.event_id as string,
        g.record_type as "single" | "average",
        "overall"
      );
      return {
        id: g.id as string,
        eventId: g.event_id as string,
        eventName: eventNames[g.event_id as string] ?? (g.event_id as string),
        recordType: g.record_type as "single" | "average",
        targetCs: g.target_cs as number,
        targetDate: g.target_date as string | null,
        status: g.status as string,
        achievedAt: g.achieved_at as string | null,
        currentCs,
      };
    })
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goals"
        description="Track progress toward the next personal-best targets."
      />
      <GoalsView
        goals={enriched}
        events={(events ?? []).map((e) => ({ id: e.id as string, name: e.name as string }))}
        hasGoals={(goals ?? []).length > 0}
      />
    </div>
  );
}
