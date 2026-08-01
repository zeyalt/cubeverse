export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { KidModeShell } from "@/components/kid/KidModeShell";
import {
  loadShell,
  loadPracticeTab,
  loadCompetitionsTab,
  loadAnalyticsTab,
  loadBadgesTab,
  loadCubesTab,
  type Tab,
} from "@/lib/kid/tabData";

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
    const savedCube = jar.get("cubeverse_cube")?.value ?? null;
    const currentCuberId = (settings.current_cuber_id ?? settings.default_cuber_id) as string;
    const params = await searchParams;
    const activeTab = (params?.tab ?? "practice") as Tab;
    const initialSubTab = params?.sub === "competition" ? "competition" : "practice";

    const { cuberName, events, cubers } = await loadShell(db, ownerId, currentCuberId);

    const validEventId = events.some((e) => e.id === savedEvent) ? savedEvent : "333";

    // Only the tab being shown is loaded. The rest are fetched on demand by the
    // client via getTabData when the user navigates to them.
    const practiceData =
      activeTab === "practice"
        ? await loadPracticeTab(db, ownerId, currentCuberId, validEventId, events, savedCube)
        : null;
    const competitionData =
      activeTab === "competitions"
        ? await loadCompetitionsTab(db, currentCuberId, events)
        : null;
    const analyticsData =
      activeTab === "analytics"
        ? await loadAnalyticsTab(db, ownerId, currentCuberId, validEventId, events)
        : null;
    const badgesData =
      activeTab === "badges" ? await loadBadgesTab(db, currentCuberId) : null;
    const cubesData =
      activeTab === "cubes"
        ? await loadCubesTab(db, ownerId, currentCuberId, validEventId, events)
        : null;

    return (
      // The try/catch guards the awaited data fetches above (redirecting to
      // onboarding on failure), not render errors from this element.
      // eslint-disable-next-line react-hooks/error-boundaries
      <KidModeShell
        cuberName={cuberName}
        cuberId={currentCuberId}
        currentCuberId={currentCuberId}
        cubers={cubers}
        activeTab={activeTab}
        initialSubTab={initialSubTab}
        selectedEventId={validEventId}
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
