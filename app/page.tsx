export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { KidModeHome } from "@/components/kid/KidModeHome";
import { effectiveTime, DNF } from "@/lib/cubing";
import type { Penalty } from "@/lib/cubing";
import { computeStreak } from "@/lib/streak";

export default async function Home() {
  try {
    const db = getServiceClient();
    const ownerId = getOwnerId();

    const result = await db
      .from("app_settings")
      .select("default_cuber_id")
      .eq("owner_id", ownerId)
      .maybeSingle();

    const settings = result.data;

    if (!settings) redirect("/setup");

    const jar = await cookies();
    const savedEvent = jar.get("cubeverse_event")?.value ?? "333";
    const cuberId = settings.default_cuber_id as string;

    const [{ data: cuber }, { data: events }, { data: todaySolves }, streak] =
      await Promise.all([
        db
          .from("cubers")
          .select("name, display_name")
          .eq("id", cuberId)
          .single(),
        db
          .from("events")
          .select("id, name, format")
          .gte("sort_order", 1)
          .lte("sort_order", 7)
          .order("sort_order"),
        db
          .from("solves")
          .select("time_cs, penalty")
          .eq("owner_id", ownerId)
          .eq("event_id", savedEvent)
          .eq("context", "practice")
          .gte("solved_at", new Date().toISOString().slice(0, 10)), // today
        computeStreak(db, cuberId),
      ]);

    const validEventId =
      events?.some((e) => e.id === savedEvent) ? savedEvent : "333";

    const todayCount = todaySolves?.length ?? 0;
    const todayTimes = (todaySolves ?? []).map((s) =>
      effectiveTime(s.time_cs as number, s.penalty as Penalty)
    );
    const nonDnf = todayTimes.filter((t) => t !== DNF);
    const todayBestCs =
      todayCount === 0 ? null : nonDnf.length > 0 ? Math.min(...nonDnf) : DNF;

    return (
      <KidModeHome
        cuberName={cuber?.display_name ?? cuber?.name ?? "Cuber"}
        events={events ?? []}
        defaultEventId={validEventId}
        cuberId={cuberId}
        todayCount={todayCount}
        todayBestCs={todayBestCs}
        streak={streak}
      />
    );
  } catch (error) {
    console.error("Error in Home page:", error);
    redirect("/setup");
  }
}
