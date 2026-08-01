"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

export type Tab = "practice" | "competitions" | "analytics" | "badges" | "cubes";

export function TabLoading() {
  return (
    <div className="flex flex-1 items-center justify-center text-white/40">
      <Loader2 className="size-7 animate-spin" />
    </div>
  );
}

// Practice is the default tab, so it stays a static import in KidModeShell and
// ships in the first-paint bundle. The other four are split out: Analytics
// alone pulls in Recharts (~468 KB raw), which a child who only ever practises
// should never have to download or parse.
//
// The import specifiers below are duplicated between each dynamic() call and
// its prefetch thunk on purpose — the bundler needs the literal path at each
// call site, and it dedupes them onto the same chunk.

export const KidCompetitionTab = dynamic(
  () => import("./KidCompetitionTab").then((m) => m.KidCompetitionTab),
  { loading: TabLoading }
);

export const KidAnalyticsTab = dynamic(
  () => import("./KidAnalyticsTab").then((m) => m.KidAnalyticsTab),
  { loading: TabLoading }
);

export const KidBadgesTab = dynamic(
  () => import("./KidBadgesTab").then((m) => m.KidBadgesTab),
  { loading: TabLoading }
);

export const KidCubesTab = dynamic(
  () => import("./KidCubesTab").then((m) => m.KidCubesTab),
  { loading: TabLoading }
);

const prefetched = new Set<Tab>();

/**
 * Warm a tab's chunk before it's needed. Called on pointerdown rather than
 * click so the download overlaps the ~100ms between finger-down and tap
 * completion, which is usually enough to hide the chunk fetch entirely.
 */
export function prefetchTab(tab: Tab): void {
  if (tab === "practice" || prefetched.has(tab)) return;
  prefetched.add(tab);
  switch (tab) {
    case "competitions":
      void import("./KidCompetitionTab");
      break;
    case "analytics":
      void import("./KidAnalyticsTab");
      break;
    case "badges":
      void import("./KidBadgesTab");
      break;
    case "cubes":
      void import("./KidCubesTab");
      break;
  }
}
