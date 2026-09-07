"use client";

import { createContext, useContext } from "react";
import type { Tab } from "./lazyTabs";

/**
 * Lets a tab tell the shell that a mutation has invalidated other tabs' cached
 * data.
 *
 * Tab data used to be refreshed by `revalidatePath("/")` re-rendering the whole
 * page. Now that switching tabs no longer navigates, nothing re-runs that
 * render mid-session, so invalidation has to be explicit: after a mutation, say
 * which tabs are now wrong and the shell refetches them when they're next
 * shown.
 */
export type OpenTabOptions = {
  /** Expand Analytics → Practice History and scroll it into view. */
  openHistory?: boolean;
};

export type PracticeHeaderControls = {
  voiceOn: boolean;
  canRescramble: boolean;
  toggleVoice: () => void;
  reshuffle: () => void;
};

export const KidDataContext = createContext<{
  invalidate: (...tabs: Tab[]) => void;
  openTab: (tab: Tab, opts?: OpenTabOptions) => void;
  practiceHeader: PracticeHeaderControls | null;
  setPracticeHeader: (controls: PracticeHeaderControls | null) => void;
}>({
  // No-op default so a tab rendered outside the shell (or in isolation) still
  // works; it just won't propagate invalidation.
  invalidate: () => {},
  openTab: () => {},
  practiceHeader: null,
  setPracticeHeader: () => {},
});

export function useKidData() {
  return useContext(KidDataContext);
}
