"use client";

import { useSyncExternalStore } from "react";
import { Timer, Trophy, BarChart2, Star, Dumbbell, Bluetooth } from "lucide-react";
import { prefetchTab, type Tab } from "./lazyTabs";
import { isWebBluetoothSupported } from "@/lib/smartcube/support";

interface KidBottomNavProps {
  activeTab: Tab;
  onSwitch: (tab: Tab) => void;
}

const TABS: Array<{
  id: Tab;
  label: string;
  icon: typeof Timer;
  requiresBluetooth?: boolean;
}> = [
  { id: "practice" as const, label: "Practice", icon: Timer },
  { id: "competitions" as const, label: "Competitions", icon: Trophy },
  { id: "analytics" as const, label: "Analytics", icon: BarChart2 },
  { id: "badges" as const, label: "Badges", icon: Star },
  { id: "trainer" as const, label: "Trainer", icon: Dumbbell },
  { id: "smart" as const, label: "Smart", icon: Bluetooth, requiresBluetooth: true },
];

/** Bluetooth availability is fixed for the life of the page, so there is nothing to subscribe to. */
const subscribeNever = () => () => {};

export function KidBottomNav({ activeTab, onSwitch }: KidBottomNavProps) {
  // The app is statically exported, so the prerendered HTML can't know whether this browser has
  // Bluetooth. `useSyncExternalStore` is the hydration-safe way to ask: React renders the server
  // snapshot (false) first, then swaps to the real answer, with no mismatch and no effect.
  const bluetoothReady = useSyncExternalStore(subscribeNever, isWebBluetoothSupported, () => false);

  // Web Bluetooth is Chrome/Edge on desktop and Android only. A permanently dead sixth tab on an
  // iPhone is worse than no tab, so it only appears where it can actually work — `?tab=smart`
  // still reaches the tab's own explanation.
  const tabs = TABS.filter((tab) => !tab.requiresBluetooth || bluetoothReady || tab.id === activeTab);

  return (
    <nav
      className="kid-bottom-nav fixed bottom-0 left-0 right-0 z-50 flex items-stretch border-t border-token"
      style={{
        backdropFilter: "blur(16px)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const active = id === activeTab;
        return (
          <button
            key={id}
            onClick={() => onSwitch(id)}
            // Start fetching the tab's chunk as the finger goes down, so the
            // download overlaps the rest of the tap.
            onPointerDown={() => prefetchTab(id)}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className="flex min-h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-1 py-3 px-2 transition-transform active:scale-90 [touch-action:manipulation]"
          >
            {/* Always reserve the indicator's height so switching tabs never
                nudges the icon/label up or down. */}
            <span
              className="h-0.5 w-5 rounded-full transition-all"
              style={{ backgroundColor: active ? "var(--kid-accent)" : "transparent" }}
            />
            <Icon
              className={`size-5 transition-colors ${active ? "" : "text-token-muted"}`}
              style={active ? { color: "var(--kid-accent)" } : undefined}
            />
            <span
              className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${active ? "" : "text-token-muted"}`}
              style={active ? { color: "var(--kid-accent)" } : undefined}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
