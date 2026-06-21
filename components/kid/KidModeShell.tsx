"use client";

import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
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
  cubes: { id: string; name: string; event_id: string | null }[];
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

function TabContent({
  tab,
  ...data
}: {
  tab: Tab;
  practiceData?: PracticeTabData | null;
  competitionData?: CompetitionTabData | null;
  analyticsData?: AnalyticsTabData | null;
  badgesData?: BadgesTabData | null;
  cubesData?: CubesTabData | null;
}) {
  switch (tab) {
    case "practice":
      return data.practiceData ? (
        <KidPracticeTab {...data.practiceData} />
      ) : null;
    case "competitions":
      return data.competitionData ? (
        <KidCompetitionTab data={data.competitionData} />
      ) : null;
    case "analytics":
      return data.analyticsData ? (
        <KidAnalyticsTab {...data.analyticsData} />
      ) : null;
    case "badges":
      return data.badgesData ? (
        <KidBadgesTab data={data.badgesData} />
      ) : null;
    case "cubes":
      return data.cubesData ? (
        <KidCubesTab data={data.cubesData} />
      ) : null;
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

  function switchTab(tab: Tab) {
    setCurrentTab(tab);
    router.replace(`/?tab=${tab}`, { scroll: false });
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
          <TabContent
            tab={currentTab}
            practiceData={practiceData}
            competitionData={competitionData}
            analyticsData={analyticsData}
            badgesData={badgesData}
            cubesData={cubesData}
          />
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
