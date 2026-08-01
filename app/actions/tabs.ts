"use server";

import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import {
  loadEvents,
  loadPracticeTab,
  loadCompetitionsTab,
  loadAnalyticsTab,
  loadBadgesTab,
  loadCubesTab,
  type Tab,
  type PracticeTabData,
  type CompetitionTabData,
  type AnalyticsTabData,
  type BadgesTabData,
  type CubesTabData,
} from "@/lib/kid/tabData";

/**
 * Discriminated so the client can write the result straight into its tab cache
 * without a cast, and so a response that arrives after the user has moved on
 * can be matched against the tab that was actually requested.
 */
export type TabDataResult =
  | { tab: "practice"; data: PracticeTabData }
  | { tab: "competitions"; data: CompetitionTabData }
  | { tab: "analytics"; data: AnalyticsTabData }
  | { tab: "badges"; data: BadgesTabData }
  | { tab: "cubes"; data: CubesTabData };

/**
 * Loads one tab's data on demand, so switching tabs no longer has to re-render
 * the whole page server-side just to reach a single branch.
 *
 * ownerId is resolved here rather than accepted as an argument — it must never
 * come from client input.
 */
export async function getTabData(
  tab: Tab,
  cuberId: string,
  eventId: string,
  selectedCubeId: string | null = null
): Promise<TabDataResult> {
  const db = getServiceClient();
  const ownerId = getOwnerId();
  const events = await loadEvents(db);

  switch (tab) {
    case "practice":
      return {
        tab,
        data: await loadPracticeTab(db, ownerId, cuberId, eventId, events, selectedCubeId),
      };
    case "competitions":
      return { tab, data: await loadCompetitionsTab(db, cuberId, events) };
    case "analytics":
      return { tab, data: await loadAnalyticsTab(db, ownerId, cuberId, eventId, events) };
    case "badges":
      return { tab, data: await loadBadgesTab(db, cuberId) };
    case "cubes":
      return { tab, data: await loadCubesTab(db, ownerId, cuberId, eventId, events) };
  }
}
