"use client";

import { Timer, Trophy, BarChart2, Star, Box } from "lucide-react";

type Tab = "practice" | "competitions" | "analytics" | "badges" | "cubes";

interface KidBottomNavProps {
  activeTab: Tab;
  onSwitch: (tab: Tab) => void;
}

const TABS = [
  { id: "practice" as const, label: "Practice", icon: Timer },
  { id: "competitions" as const, label: "Competitions", icon: Trophy },
  { id: "analytics" as const, label: "Analytics", icon: BarChart2 },
  { id: "badges" as const, label: "Badges", icon: Star },
  { id: "cubes" as const, label: "Cubes", icon: Box },
];

export function KidBottomNav({ activeTab, onSwitch }: KidBottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch border-t border-white/8"
      style={{
        background: "rgba(10, 10, 10, 0.92)",
        backdropFilter: "blur(16px)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = id === activeTab;
        return (
          <button
            key={id}
            onClick={() => onSwitch(id)}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className="flex min-h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-1 py-3 px-2 transition-transform active:scale-90 [touch-action:manipulation]"
          >
            {/* Always reserve the indicator's height so switching tabs never
                nudges the icon/label up or down. */}
            <span
              className="h-0.5 w-5 rounded-full transition-all"
              style={{ backgroundColor: active ? "#FFD500" : "transparent" }}
            />
            <Icon
              className="size-5 transition-colors"
              style={{ color: active ? "#FFD500" : "rgba(255, 255, 255, 0.4)" }}
            />
            <span
              className="text-[10px] font-bold uppercase tracking-wider transition-colors"
              style={{ color: active ? "#FFD500" : "rgba(255, 255, 255, 0.4)" }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
