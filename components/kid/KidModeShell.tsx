"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { KidHeader } from "./KidHeader";
import { KidBottomNav } from "./KidBottomNav";
import { KidPracticeTab } from "./KidPracticeTab";
import { KidCompetitionTab } from "./KidCompetitionTab";
import { KidAnalyticsTab } from "./KidAnalyticsTab";
import { KidBadgesTab } from "./KidBadgesTab";
import { KidCubesTab } from "./KidCubesTab";
import { SettingsSheet } from "./SettingsSheet";
import { CuberSwitcherSheet } from "./CuberSwitcherSheet";
import type { AnalyticsPayload } from "@/app/actions/analytics";

type Tab = "practice" | "competitions" | "analytics" | "badges" | "cubes";

interface Event {
  id: string;
  name: string;
  format: string;
}

interface PracticeTabData {
  events: Event[];
  defaultEventId: string;
  cuberId: string;
  cubes: { id: string; name: string; brand: string | null; event_id: string | null }[];
  activeGoal: { id: string; target_cs: number } | null;
  ao5: number | null;
  ao12: number | null;
  ao50: number | null;
  ao100: number | null;
  best: number | null;
  count: number;
  recentTimes: number[];
}

interface CompetitionTabData {
  competitions: Array<{
    id: string;
    name: string;
    type: string;
    city: string | null;
    country: string | null;
    start_date: string | null;
    end_date: string | null;
    eventIds: string[];
  }>;
  cuberId: string;
  wcaId: string | null;
}

interface Cube {
  id: string;
  name: string;
  brand: string | null;
}

interface AnalyticsTabData {
  events: Event[];
  defaultEventId: string;
  cuberId: string;
  initialAnalyticsData: AnalyticsPayload;
  pbs: Array<{
    eventId: string;
    officialSingle: number | null;
    officialAvg: number | null;
    wcaSingle: number | null;
    wcaAvg: number | null;
    unofficialSingle: number | null;
    unofficialAvg: number | null;
    practiceSingle: number | null;
    practiceAo5: number | null;
    practiceAo12: number | null;
    practiceAo50: number | null;
    practiceAo100: number | null;
    practiceCount: number;
  }>;
  cubes: Cube[];
}

interface BadgesTabData {
  achievements: Array<{
    badge_key: string;
    unlocked_at: string | null;
    metadata: Record<string, unknown> | null;
  }>;
  unlockedCount: number;
  totalCount: number;
}

interface CubeRow {
  id: string;
  name: string;
  brand: string | null;
  eventId: string | null;
  eventName: string | null;
  isMain: boolean;
  photoUrl: string | null;
  acquiredOn: string | null;
  notes: string | null;
}

interface EventOption {
  id: string;
  name: string;
}

interface CubesTabData {
  cubes: CubeRow[];
  events: EventOption[];
  cuberId: string;
  defaultEventId: string;
}

interface Cuber {
  id: string;
  name: string;
  display_name: string | null;
  avatar_color: string;
}

interface KidModeShellProps {
  cuberName: string;
  cuberId: string;
  currentCuberId: string;
  cubers: Cuber[];
  activeTab: Tab;
  practiceData?: PracticeTabData | null;
  competitionData?: CompetitionTabData | null;
  analyticsData?: AnalyticsTabData | null;
  badgesData?: BadgesTabData | null;
  cubesData?: CubesTabData | null;
}

function TabLoading() {
  return (
    <div className="flex flex-1 items-center justify-center text-white/40">
      <Loader2 className="size-7 animate-spin" />
    </div>
  );
}

interface TabDataCache {
  practice?: PracticeTabData;
  competitions?: CompetitionTabData;
  analytics?: AnalyticsTabData;
  badges?: BadgesTabData;
  cubes?: CubesTabData;
}

function TabContent({ tab, cache }: { tab: Tab; cache: TabDataCache }) {
  // Render from the client cache so revisiting a tab is instant. A tab only
  // shows the spinner the first time it's opened (before its data has loaded).
  switch (tab) {
    case "practice":
      return cache.practice ? <KidPracticeTab {...cache.practice} /> : <TabLoading />;
    case "competitions":
      return cache.competitions ? <KidCompetitionTab data={cache.competitions} /> : <TabLoading />;
    case "analytics":
      return cache.analytics ? <KidAnalyticsTab {...cache.analytics} /> : <TabLoading />;
    case "badges":
      return cache.badges ? <KidBadgesTab data={cache.badges} /> : <TabLoading />;
    case "cubes":
      return cache.cubes ? <KidCubesTab data={cache.cubes} /> : <TabLoading />;
    default:
      return null;
  }
}

function KidModeShellContent({
  cuberName,
  currentCuberId,
  cubers,
  activeTab,
  practiceData,
  competitionData,
  analyticsData,
  badgesData,
  cubesData,
}: KidModeShellProps) {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState<Tab>(activeTab);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Client-side cache of each tab's server data. Server props only carry the
  // active tab, so we accumulate them here — letting us re-show a previously
  // visited tab instantly while a fresh copy loads in the background.
  const [cache, setCache] = useState<TabDataCache>(() => ({
    practice: practiceData ?? undefined,
    competitions: competitionData ?? undefined,
    analytics: analyticsData ?? undefined,
    badges: badgesData ?? undefined,
    cubes: cubesData ?? undefined,
  }));
  const cuberRef = useRef(currentCuberId);

  useEffect(() => {
    // Different cuber ⇒ every cached tab is stale, so start clean.
    const cuberChanged = cuberRef.current !== currentCuberId;
    cuberRef.current = currentCuberId;
    setCache((prev) => ({
      ...(cuberChanged ? {} : prev),
      ...(practiceData ? { practice: practiceData } : {}),
      ...(competitionData ? { competitions: competitionData } : {}),
      ...(analyticsData ? { analytics: analyticsData } : {}),
      ...(badgesData ? { badges: badgesData } : {}),
      ...(cubesData ? { cubes: cubesData } : {}),
    }));
  }, [currentCuberId, practiceData, competitionData, analyticsData, badgesData, cubesData]);

  function switchTab(tab: Tab) {
    if (tab === currentTab) return;
    setCurrentTab(tab); // cached tabs render instantly; others show a spinner
    startTransition(() => {
      router.replace(`/?tab=${tab}`, { scroll: false });
    });
  }

  return (
    <div className="kid-canvas relative flex h-dvh flex-col overflow-hidden text-white">
      <KidHeader
        cuberName={cuberName}
        currentCuberId={currentCuberId}
        cubers={cubers}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenSwitcher={() => setSwitcherOpen(true)}
      />

      {/* Tab content + bottom nav are hidden while the cuber switcher is open
          so the puzzle/scramble/timer/metrics don't show through or overlap.
          flex-1 + min-h-0 lets <main> own the remaining viewport height so the
          practice screen can lay itself out as a real flex column. */}
      <div className={`flex flex-1 flex-col min-h-0 ${switcherOpen ? "invisible" : ""}`}>
        <main className="flex flex-1 flex-col min-h-0 overflow-y-auto kid-tab-enter" style={{ paddingBottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}>
          <TabContent tab={currentTab} cache={cache} />
        </main>

        <KidBottomNav activeTab={currentTab} onSwitch={switchTab} />
      </div>

      {settingsOpen && (
        <SettingsSheet
          onClose={() => setSettingsOpen(false)}
          cuberId={currentCuberId}
        />
      )}

      {switcherOpen && (
        <CuberSwitcherSheet
          cubers={cubers}
          currentCuberId={currentCuberId}
          onClose={() => setSwitcherOpen(false)}
        />
      )}
    </div>
  );
}

export function KidModeShell(props: KidModeShellProps) {
  return (
    <Suspense fallback={<div className="kid-canvas h-screen" />}>
      <KidModeShellContent {...props} />
    </Suspense>
  );
}
