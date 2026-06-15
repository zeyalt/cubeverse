export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { KidModeShell } from "@/components/kid/KidModeShell";
import { effectiveTime, aoN, DNF } from "@/lib/cubing";
import type { Penalty } from "@/lib/cubing";
import { computeStreak } from "@/lib/streak";
import { getCurrentPbs } from "@/lib/analytics";
import { getAnalyticsData } from "@/app/actions/analytics";

const ACTIVE_EVENTS = ["333", "222", "pyram", "skewb", "clock", "444", "333oh"];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  try {
    const db = getServiceClient();
    const ownerId = getOwnerId();

    const result = await db
      .from("app_settings")
      .select("default_cuber_id, current_cuber_id")
      .eq("owner_id", ownerId)
      .maybeSingle();

    const settings = result.data;

    if (!settings || !settings.default_cuber_id) {
      redirect("/onboarding");
    }

    const jar = await cookies();
    const savedEvent = jar.get("cubeverse_event")?.value ?? "333";
    const currentCuberId = (settings.current_cuber_id ?? settings.default_cuber_id) as string;
    const params = await searchParams;
    const activeTab = (params?.tab ?? "practice") as "practice" | "competitions" | "analytics" | "badges" | "cubes";

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
    let analyticsData = null;
    let badgesData = null;
    let cubesData = null;

    if (activeTab === "practice") {
      const [{ data: allSolves }, { data: practiceGoal }, { data: practiceCubes }] = await Promise.all([
        db
          .from("solves")
          .select("time_cs, penalty")
          .eq("cuber_id", currentCuberId)
          .eq("event_id", validEventId)
          .eq("context", "practice")
          .order("solved_at"),
        db
          .from("goals")
          .select("id, target_cs")
          .eq("cuber_id", currentCuberId)
          .eq("event_id", validEventId)
          .eq("record_type", "single")
          .eq("status", "active")
          .maybeSingle(),
        db
          .from("cubes")
          .select("id, name, event_id")
          .eq("cuber_id", currentCuberId)
          .eq("event_id", validEventId)
          .order("is_main", { ascending: false })
          .order("name"),
      ]);

      // Effective times preserve DNFs (= -1) so the WCA-correct aoN() can treat
      // a DNF as the worst time in a window. This must match lib/analytics.ts
      // getCurrentPbs so the Practice tab and Analytics show identical metrics.
      const times = (allSolves ?? []).map((s) =>
        effectiveTime(s.time_cs as number, s.penalty as Penalty)
      );

      // Current rolling average of the last N solves (WCA rules). Returns null
      // if fewer than N solves, or if the window resolves to a DNF.
      const currentAoN = (n: number): number | null => {
        if (times.length < n) return null;
        const result = aoN(times.slice(-n));
        return result === DNF ? null : result;
      };

      const nonDnfTimes = times.filter((t) => t > 0);
      const ao5 = currentAoN(5);
      const ao12 = currentAoN(12);
      const ao50 = currentAoN(50);
      const ao100 = currentAoN(100);
      const best = nonDnfTimes.length > 0 ? Math.min(...nonDnfTimes) : null;
      const count = times.length;

      practiceData = {
        events: events ?? [],
        defaultEventId: validEventId,
        cuberId: currentCuberId,
        cubes: (practiceCubes ?? []).map((c) => ({ id: c.id as string, name: c.name as string, event_id: c.event_id as string | null })),
        activeGoal: practiceGoal ? { id: practiceGoal.id as string, target_cs: practiceGoal.target_cs as number } : null,
        ao5,
        ao12,
        ao50,
        ao100,
        best,
        count,
        // Full ordered list of effective times for this event, so the client can
        // recompute the 6 metrics live after each in-session solve.
        recentTimes: times,
      };
    } else if (activeTab === "competitions") {
      const [{ data: comps }, { data: cuber }] = await Promise.all([
        db
          .from("competitions")
          .select("id, name, type, city, country, start_date, end_date")
          .eq("cuber_id", currentCuberId)
          .order("start_date", { ascending: false }),
        db
          .from("cubers")
          .select("wca_id")
          .eq("id", currentCuberId)
          .single(),
      ]);

      competitionData = {
        competitions: comps ?? [],
        cuberId: currentCuberId,
        wcaId: cuber?.wca_id ?? null,
      };
    } else if (activeTab === "analytics") {
      const [pbs, initialData] = await Promise.all([
        getCurrentPbs(db, currentCuberId, ACTIVE_EVENTS),
        getAnalyticsData(currentCuberId, validEventId),
      ]);

      const { data: cubes } = await db
        .from("cubes")
        .select("id, name")
        .eq("cuber_id", currentCuberId)
        .order("is_main", { ascending: false })
        .order("created_at");

      analyticsData = {
        events: events ?? [],
        defaultEventId: validEventId,
        cuberId: currentCuberId,
        initialAnalyticsData: initialData,
        pbs,
        cubes: cubes ?? [],
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
        analyticsData={analyticsData}
        badgesData={badgesData}
        cubesData={cubesData}
      />
    );
  } catch (error) {
    console.error("Error in Home page:", error);
    redirect("/onboarding");
  }
}
