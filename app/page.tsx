export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { KidModeHome } from "@/components/kid/KidModeHome";
import { effectiveTime, DNF } from "@/lib/cubing";
import type { Penalty } from "@/lib/cubing";
import { computeStreak } from "@/lib/streak";
import { getBadgeInfo } from "@/lib/badges";

export default async function Home() {
  const db = getServiceClient();
  const ownerId = getOwnerId();

  const { data: settings } = await db
    .from("app_settings")
    .select("default_cuber_id")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!settings) redirect("/setup");

  const jar = await cookies();
  const savedEvent = jar.get("cubeverse_event")?.value ?? "333";

  const cuberId = settings.default_cuber_id as string;

  const [{ data: cuber }, { data: events }, { data: todaySolves }, streak, { data: trophies }] =
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
      db
        .from("achievements")
        .select("badge_key, unlocked_at")
        .eq("cuber_id", cuberId)
        .order("unlocked_at", { ascending: false })
        .limit(6),
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

  const recentTrophies = (trophies ?? []).map((t) => {
    const info = getBadgeInfo(t.badge_key as string);
    return { ...info, unlockedAt: t.unlocked_at as string };
  });

  return (
    <KidModeHome
      cuberName={cuber?.display_name ?? cuber?.name ?? "Cuber"}
      events={events ?? []}
      defaultEventId={validEventId}
      todayCount={todayCount}
      todayBestCs={todayBestCs}
      streak={streak}
      trophies={recentTrophies}
    />
  );
}
