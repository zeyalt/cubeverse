"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import { KidHeader } from "./KidHeader";
import { KidBottomNav } from "./KidBottomNav";
import { KidPracticeTab } from "./KidPracticeTab";
import { KidCompetitionTab } from "./KidCompetitionTab";
import { KidOverviewTab } from "./KidOverviewTab";
import { KidBadgesTab } from "./KidBadgesTab";
import { KidCubesTab } from "./KidCubesTab";

type Tab = "practice" | "competition" | "overview" | "badges" | "cubes";

interface Event {
  id: string;
  name: string;
  format: string;
}

interface PracticeTabData {
  events: Event[];
  defaultEventId: string;
  cuberId: string;
  todayCount: number;
  todayBestCs: number | null;
  streak: number;
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
  }>;
}

interface OverviewTabData {
  pbs: Array<{
    eventId: string;
    officialSingle: number | null;
    officialAvg: number | null;
    practiceSingle: number | null;
    practiceAvg: number | null;
  }>;
  heatmap: Record<string, number>;
  totalSolves: number;
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
  overviewData?: OverviewTabData | null;
  badgesData?: BadgesTabData | null;
  cubesData?: CubesTabData | null;
}

function TabContent({ tab, ...data }: { tab: Tab } & Record<string, any>) {
  switch (tab) {
    case "practice":
      return data.practiceData ? (
        <KidPracticeTab {...data.practiceData} />
      ) : null;
    case "competition":
      return data.competitionData ? (
        <KidCompetitionTab data={data.competitionData} />
      ) : null;
    case "overview":
      return data.overviewData ? (
        <KidOverviewTab data={data.overviewData} />
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
  cuberId,
  currentCuberId,
  cubers,
  activeTab,
  practiceData,
  competitionData,
  overviewData,
  badgesData,
  cubesData,
}: KidModeShellProps) {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState<Tab>(activeTab);

  function switchTab(tab: Tab) {
    setCurrentTab(tab);
    router.replace(`/?tab=${tab}`, { scroll: false });
  }

  return (
    <div className="kid-canvas relative flex min-h-screen flex-col text-white">
      <KidHeader cuberName={cuberName} currentCuberId={currentCuberId} cubers={cubers} />

      <main className="flex-1 overflow-y-auto kid-tab-enter" style={{ paddingBottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}>
        <TabContent
          tab={currentTab}
          practiceData={practiceData}
          competitionData={competitionData}
          overviewData={overviewData}
          badgesData={badgesData}
          cubesData={cubesData}
        />
      </main>

      <KidBottomNav activeTab={currentTab} onSwitch={switchTab} />
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
