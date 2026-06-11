export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { KidModeShell } from "@/components/kid/KidModeShell";
import { effectiveTime, DNF } from "@/lib/cubing";
import type { Penalty } from "@/lib/cubing";
import { computeStreak } from "@/lib/streak";
import { getCurrentPbs, getHeatmapCounts } from "@/lib/analytics";

const ACTIVE_EVENTS = ["333", "222", "pyram", "skewb", "clock", "444", "333oh"];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  try {
    const db = getServiceClient();
    const ownerId = getOwnerId();

    let result = await db
      .from("app_settings")
      .select("default_cuber_id, current_cuber_id")
      .eq("owner_id", ownerId)
      .maybeSingle();

    // If schema cache is stale and current_cuber_id doesn't exist, fall back to just default_cuber_id
    if (result.error && result.error.message?.includes("current_cuber_id")) {
      console.warn("[app/page] Schema cache stale for current_cuber_id, falling back to default_cuber_id only");
      result = await db
        .from("app_settings")
        .select("default_cuber_id")
        .eq("owner_id", ownerId)
        .maybeSingle();
    }

    const settings = result.data;
    console.log("[app/page] Settings query result:", { error: result.error, settings });

    if (!settings || !settings.default_cuber_id) {
      console.log("[app/page] No settings found, redirecting to onboarding");
      redirect("/onboarding");
    }

    const jar = await cookies();
    const savedEvent = jar.get("cubeverse_event")?.value ?? "333";
    const currentCuberId = (settings.current_cuber_id ?? settings.default_cuber_id) as string;
    const params = await searchParams;
    const activeTab = (params?.tab ?? "overview") as "practice" | "competition" | "overview" | "badges" | "cubes";

    // Always fetch cuber name, all cubers, and events
    const [{ data: cuber }, { data: events }, { data: allCubers }] = await Promise.all([
      db
        .from("cubers")
        .select("name, display_name")
        .eq("id", currentCuberId)
        .single(),
      db
        .from("events")
        .select("id, name, format")
        .gte("sort_order", 1)
        .lte("sort_order", 7)
        .order("sort_order"),
      db
        .from("cubers")
        .select("id, name, display_name, avatar_color")
        .eq("owner_id", ownerId)
        .order("name"),
    ]);

    const validEventId =
      events?.some((e) => e.id === savedEvent) ? savedEvent : "333";

    // Tab-specific data fetching
    let practiceData = null;
    let competitionData = null;
    let overviewData = null;
    let badgesData = null;
    let cubesData = null;

    if (activeTab === "practice") {
      const [{ data: todaySolves }, streak] = await Promise.all([
        db
          .from("solves")
          .select("time_cs, penalty")
          .eq("owner_id", ownerId)
          .eq("event_id", savedEvent)
          .eq("context", "practice")
          .gte("solved_at", new Date().toISOString().slice(0, 10)),
        computeStreak(db, currentCuberId),
      ]);

      const todayCount = todaySolves?.length ?? 0;
      const todayTimes = (todaySolves ?? []).map((s) =>
        effectiveTime(s.time_cs as number, s.penalty as Penalty)
      );
      const nonDnf = todayTimes.filter((t) => t !== DNF);
      const todayBestCs =
        todayCount === 0 ? null : nonDnf.length > 0 ? Math.min(...nonDnf) : DNF;

      practiceData = {
        events: events ?? [],
        defaultEventId: validEventId,
        cuberId: currentCuberId,
        todayCount,
        todayBestCs,
        streak,
      };
    } else if (activeTab === "competition") {
      const { data: comps } = await db
        .from("competitions")
        .select("id, name, type, city, country, start_date, end_date")
        .eq("cuber_id", currentCuberId)
        .order("start_date", { ascending: false });

      competitionData = {
        competitions: comps ?? [],
      };
    } else if (activeTab === "overview") {
      const [pbs, heatmap] = await Promise.all([
        getCurrentPbs(db, currentCuberId, ACTIVE_EVENTS),
        getHeatmapCounts(db, currentCuberId),
      ]);

      const totalSolves = Object.values(heatmap).reduce((a, b) => a + b, 0);

      overviewData = {
        pbs,
        heatmap,
        totalSolves,
      };
    } else if (activeTab === "badges") {
      const { data: achievements } = await db
        .from("achievements")
        .select("badge_key, unlocked_at, metadata")
        .eq("cuber_id", currentCuberId)
        .order("unlocked_at", { ascending: false });

      const { BADGE_TIERS, ACTIVITY_BADGES } = await import("@/lib/badges");
      const unlockedCount = achievements?.length ?? 0;
      const totalCount = BADGE_TIERS.length + ACTIVITY_BADGES.length;

      badgesData = {
        achievements: achievements ?? [],
        unlockedCount,
        totalCount,
      };
    } else if (activeTab === "cubes") {
      const { data: cubes } = await db
        .from("cubes")
        .select("id, name, brand, event_id, is_main, photo_url, acquired_on, notes")
        .eq("cuber_id", currentCuberId)
        .order("is_main", { ascending: false })
        .order("created_at");

      const eventNames = Object.fromEntries(
        (events ?? []).map((e) => [e.id as string, e.name as string])
      );

      cubesData = {
        cubes: (cubes ?? []).map((c) => ({
          id: c.id as string,
          name: c.name as string,
          brand: c.brand as string | null,
          eventId: c.event_id as string | null,
          eventName: c.event_id ? eventNames[c.event_id as string] ?? null : null,
          isMain: c.is_main as boolean,
          photoUrl: c.photo_url as string | null,
          acquiredOn: c.acquired_on as string | null,
          notes: c.notes as string | null,
        })),
        events: (events ?? []).map((e) => ({
          id: e.id as string,
          name: e.name as string,
        })),
        cuberId: currentCuberId,
      };
    }

    return (
      <KidModeShell
        cuberName={cuber?.display_name ?? cuber?.name ?? "Cuber"}
        cuberId={currentCuberId}
        currentCuberId={currentCuberId}
        cubers={allCubers ?? []}
        activeTab={activeTab}
        practiceData={practiceData}
        competitionData={competitionData}
        overviewData={overviewData}
        badgesData={badgesData}
        cubesData={cubesData}
      />
    );
  } catch (error) {
    console.error("Error in Home page:", error);
    redirect("/onboarding");
  }
}
