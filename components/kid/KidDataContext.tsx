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
export const KidDataContext = createContext<{
  invalidate: (...tabs: Tab[]) => void;
}>({
  // No-op default so a tab rendered outside the shell (or in isolation) still
  // works; it just won't propagate invalidation.
  invalidate: () => {},
});

export function useKidData() {
  return useContext(KidDataContext);
}
