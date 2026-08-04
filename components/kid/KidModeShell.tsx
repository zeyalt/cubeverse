"use client";

import { Suspense, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { KidHeader } from "./KidHeader";
import { KidBottomNav } from "./KidBottomNav";
import { KidPracticeTab } from "./KidPracticeTab";
import {
  KidCompetitionTab,
  KidAnalyticsTab,
  KidBadgesTab,
  KidCubesTab,
  TabLoading,
  type Tab,
} from "./lazyTabs";
import { CuberSwitcherSheet } from "./CuberSwitcherSheet";
import { CloudOff } from "lucide-react";
import { useOfflineSync } from "@/lib/offline/syncStore";
import { getTabData } from "@/app/actions/tabs";
import { setEventCookie } from "@/lib/eventCookie";
import { KidDataContext } from "./KidDataContext";
import type {
  PracticeTabData,
  CompetitionTabData,
  AnalyticsTabData,
  BadgesTabData,
  CubesTabData,
} from "@/lib/kid/tabData";

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
  /** Analytics sub-tab from the ?sub= deep link, read once on the server. */
  initialSubTab: "practice" | "competition";
  /** Event the cookie resolved to on the server — seeds the shared client
   *  state below; every tab reads/writes that shared state from then on, not
   *  this prop directly. */
  selectedEventId: string;
  practiceData?: PracticeTabData | null;
  competitionData?: CompetitionTabData | null;
  analyticsData?: AnalyticsTabData | null;
  badgesData?: BadgesTabData | null;
  cubesData?: CubesTabData | null;
}

interface TabDataCache {
  practice?: PracticeTabData;
  competitions?: CompetitionTabData;
  analytics?: AnalyticsTabData;
  badges?: BadgesTabData;
  cubes?: CubesTabData;
}

function TabContent({
  tab,
  cache,
  initialSubTab,
  selectedEventId,
  onEventChange,
}: {
  tab: Tab;
  cache: TabDataCache;
  initialSubTab: "practice" | "competition";
  selectedEventId: string;
  onEventChange: (id: string) => void;
}) {
  // Render from the client cache so revisiting a tab is instant. A tab only
  // shows the spinner the first time it's opened (before its data has loaded).
  switch (tab) {
    case "practice":
      return cache.practice ? (
        <KidPracticeTab
          {...cache.practice}
          selectedEventId={selectedEventId}
          onEventChange={onEventChange}
        />
      ) : (
        <TabLoading />
      );
    case "competitions":
      return cache.competitions ? <KidCompetitionTab data={cache.competitions} /> : <TabLoading />;
    case "analytics":
      return cache.analytics ? (
        <KidAnalyticsTab
          {...cache.analytics}
          initialSubTab={initialSubTab}
          selectedEventId={selectedEventId}
          onEventChange={onEventChange}
        />
      ) : (
        <TabLoading />
      );
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
  initialSubTab,
  selectedEventId: initialSelectedEventId,
  practiceData,
  competitionData,
  analyticsData,
  badgesData,
  cubesData,
}: KidModeShellProps) {
  const [currentTab, setCurrentTab] = useState<Tab>(activeTab);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Single source of truth for the selected event, shared by every tab —
  // previously each tab (Practice, Analytics) kept its own local state seeded
  // once from its server-rendered defaultEventId prop, so picking an event in
  // one tab never showed up in another until a full page reload re-read the
  // cookie. Lifting it here means every tab reflects a change immediately.
  const [selectedEventId, setSelectedEventId] = useState(initialSelectedEventId);
  const handleEventChange = useCallback((id: string) => {
    setSelectedEventId(id);
    setEventCookie(id); // still written so a full reload also starts here
  }, []);

  // Client-side cache of each tab's server data. The server only renders the
  // tab that was entered on; the rest are fetched on demand and kept here, so
  // revisiting a tab is instant.
  const [cache, setCache] = useState<TabDataCache>(() => ({
    practice: practiceData ?? undefined,
    competitions: competitionData ?? undefined,
    analytics: analyticsData ?? undefined,
    badges: badgesData ?? undefined,
    cubes: cubesData ?? undefined,
  }));
  const cuberRef = useRef(currentCuberId);

  // Guards against a slow response for an earlier tab landing after a later
  // one and overwriting it — same hazard as the event-switch guard in
  // KidPracticeTab. Declared before the cache-reset effect below since that
  // effect also bumps it on a cuber change.
  const fetchGen = useRef(0);

  useEffect(() => {
    // Different cuber ⇒ every cached tab is stale, so start clean.
    const cuberChanged = cuberRef.current !== currentCuberId;
    cuberRef.current = currentCuberId;
    if (cuberChanged) {
      // A loadTab() fetch already in flight was requested for the PREVIOUS
      // cuber — its own gen check (in loadTab below) only guards against a
      // slower fetch for the same cuber landing out of order, not against a
      // cuber switch happening mid-flight. Bumping the generation here means
      // that in-flight response gets discarded instead of silently writing
      // the wrong cuber's data into the cache when it resolves.
      fetchGen.current++;
    }
    setCache((prev) => ({
      ...(cuberChanged ? {} : prev),
      ...(practiceData ? { practice: practiceData } : {}),
      ...(competitionData ? { competitions: competitionData } : {}),
      ...(analyticsData ? { analytics: analyticsData } : {}),
      ...(badgesData ? { badges: badgesData } : {}),
      ...(cubesData ? { cubes: cubesData } : {}),
    }));
  }, [currentCuberId, practiceData, competitionData, analyticsData, badgesData, cubesData]);

  // Tabs whose cached data a mutation has invalidated. They keep rendering the
  // stale copy (no spinner flash) and refetch on next view.
  const [stale, setStale] = useState<ReadonlySet<Tab>>(() => new Set());

  const loadTab = useCallback(
    (tab: Tab) => {
      const gen = ++fetchGen.current;
      startTransition(async () => {
        try {
          const res = await getTabData(tab, currentCuberId, selectedEventId);
          if (gen !== fetchGen.current) return; // superseded
          setCache((prev) => ({ ...prev, [res.tab]: res.data }));
          setStale((prev) => {
            if (!prev.has(tab)) return prev;
            const next = new Set(prev);
            next.delete(tab);
            return next;
          });
        } catch (err) {
          // Leave the cached copy in place rather than blanking the tab — an
          // offline switch should still show the last known data.
          console.error("[kid-shell] failed to load tab", tab, err);
        }
      });
    },
    [currentCuberId, selectedEventId]
  );

  const invalidate = useCallback((...tabs: Tab[]) => {
    setStale((prev) => {
      const next = new Set(prev);
      for (const t of tabs) next.add(t);
      return next;
    });
  }, []);

  // Refetch a tab that was invalidated while the user was looking at it.
  useEffect(() => {
    if (stale.has(currentTab)) loadTab(currentTab);
  }, [stale, currentTab, loadTab]);

  function switchTab(tab: Tab) {
    if (tab === currentTab) return;
    setCurrentTab(tab);

    // Keep the address bar honest so a manual reload lands on the same tab,
    // without going through the Next router — a router navigation here would
    // re-render the whole page server-side, which is exactly what this
    // refactor removes. replaceState (rather than pushState) preserves the
    // previous behaviour, where tabs did not create history entries.
    const url = tab === "practice" ? "/" : `/?tab=${tab}`;
    window.history.replaceState(null, "", url);

    if (!cache[tab] || stale.has(tab)) loadTab(tab);
  }

  // A solve that fails to save (network hiccup, transient server error, or
  // genuinely offline) is queued to IndexedDB by KidPracticeTab so it isn't
  // lost. Subscribing here drives the retry loop and the badge below.
  const { pending: pendingSync } = useOfflineSync(currentCuberId);

  return (
    <KidDataContext.Provider value={{ invalidate }}>
    <div className="kid-canvas relative flex h-dvh flex-col overflow-hidden text-white">
      <KidHeader
        cuberName={cuberName}
        currentCuberId={currentCuberId}
        cubers={cubers}
        onOpenSwitcher={() => setSwitcherOpen(true)}
      />

      {/* Solves waiting to sync — surfaced so a save that got queued (network
          hiccup, offline) doesn't sit invisibly; it's actively being retried. */}
      {pendingSync > 0 && !switcherOpen && (
        <div
          className="fixed left-1/2 top-[max(0.5rem,env(safe-area-inset-top))] z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[#B71234]/40 bg-[#B71234]/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg"
        >
          <CloudOff className="size-3" />
          {pendingSync} solve{pendingSync === 1 ? "" : "s"} syncing…
        </div>
      )}

      {/* Tab content + bottom nav are hidden while the cuber switcher is open
          so the puzzle/scramble/timer/metrics don't show through or overlap.
          flex-1 + min-h-0 lets <main> own the remaining viewport height so the
          practice screen can lay itself out as a real flex column. */}
      <div className={`flex flex-1 flex-col min-h-0 ${switcherOpen ? "invisible" : ""}`}>
        <main className="flex flex-1 flex-col min-h-0 overflow-y-auto kid-tab-enter" style={{ paddingBottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}>
          <TabContent
            tab={currentTab}
            cache={cache}
            initialSubTab={initialSubTab}
            selectedEventId={selectedEventId}
            onEventChange={handleEventChange}
          />
        </main>

        <KidBottomNav activeTab={currentTab} onSwitch={switchTab} />
      </div>

      {switcherOpen && (
        <CuberSwitcherSheet
          cubers={cubers}
          currentCuberId={currentCuberId}
          onClose={() => setSwitcherOpen(false)}
        />
      )}
    </div>
    </KidDataContext.Provider>
  );
}

export function KidModeShell(props: KidModeShellProps) {
  return (
    <Suspense fallback={<div className="kid-canvas h-screen" />}>
      <KidModeShellContent {...props} />
    </Suspense>
  );
}
