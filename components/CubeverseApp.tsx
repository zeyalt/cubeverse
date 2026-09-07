"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KidModeShell } from "@/components/kid/KidModeShell";
import { getClientTabData, loadClientSettings, loadClientShell } from "@/lib/client/tabData";
import type {
  AnalyticsTabData,
  BadgesTabData,
  CompetitionTabData,
  PracticeTabData,
  ShellData,
  Tab,
  TrainerTabData,
} from "@/lib/kid/tabData";
import { requireUser } from "@/lib/supabase/auth";
import { cacheEntity, getCachedEntity } from "@/lib/offline/entities";

type Ready = {
  shell: ShellData;
  cuberId: string;
  activeTab: Tab;
  selectedEventId: string;
  practiceData: PracticeTabData | null;
  competitionData: CompetitionTabData | null;
  analyticsData: AnalyticsTabData | null;
  badgesData: BadgesTabData | null;
  trainerData: TrainerTabData | null;
  initialOpenHistory: boolean;
};

export function CubeverseApp() {
  const router = useRouter();
  const [ready, setReady] = useState<Ready | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const requested = params.get("tab") === "cubes" ? "trainer" : params.get("tab");
        const activeTab: Tab =
          requested === "competitions" || requested === "analytics" || requested === "badges" || requested === "trainer"
            ? requested
            : "practice";
        const initialOpenHistory = activeTab === "analytics" && params.get("history") === "1";
        const { ownerId } = await requireUser();
        const scope = `owner:${ownerId}`;
        const cached = await getCachedEntity<Ready>(scope, "app-shell", "current", {
          includeTombstone: false,
        });
        if (cached?.value?.activeTab === activeTab && !cancelled) setReady(cached.value);

        const settings = await loadClientSettings();
        const cuberId = settings?.current_cuber_id ?? settings?.default_cuber_id;
        if (!cuberId) {
          router.replace("/onboarding");
          return;
        }
        const selectedEventId = localStorage.getItem("cubeverse_event") ?? "333";
        const [shell, tab] = await Promise.all([
          loadClientShell(cuberId),
          getClientTabData(activeTab, cuberId, selectedEventId),
        ]);
        if (cancelled) return;
        const next: Ready = {
          shell,
          cuberId,
          activeTab,
          selectedEventId,
          practiceData: tab.tab === "practice" ? tab.data : null,
          competitionData: tab.tab === "competitions" ? tab.data : null,
          analyticsData: tab.tab === "analytics" ? tab.data : null,
          badgesData: tab.tab === "badges" ? tab.data : null,
          trainerData: tab.tab === "trainer" ? tab.data : null,
          initialOpenHistory,
        };
        setReady(next);
        void cacheEntity({ scope, entityType: "app-shell", entityId: "current", value: next });
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load Cubeverse");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <main className="kid-canvas flex min-h-dvh items-center justify-center p-6 text-center text-white">
        <div className="surface max-w-sm p-5">
          <h1 className="font-display text-xl font-bold">Could not load Cubeverse</h1>
          <p className="mt-2 text-sm text-white/60">{error}</p>
          <button className="btn-accent mt-4 min-h-11 px-5" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (!ready) return <div className="kid-canvas min-h-dvh" aria-label="Loading Cubeverse" />;

  return (
    <KidModeShell
      cuberName={ready.shell.cuberName}
      cuberId={ready.cuberId}
      currentCuberId={ready.cuberId}
      cubers={ready.shell.cubers}
      activeTab={ready.activeTab}
      initialSubTab="practice"
      selectedEventId={ready.selectedEventId}
      practiceData={ready.practiceData}
      competitionData={ready.competitionData}
      analyticsData={ready.analyticsData}
      badgesData={ready.badgesData}
      trainerData={ready.trainerData}
      initialOpenHistory={ready.initialOpenHistory}
    />
  );
}
