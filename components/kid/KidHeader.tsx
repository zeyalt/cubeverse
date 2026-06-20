"use client";

import { Settings, ChevronDown } from "lucide-react";

const AVATAR_HEX: Record<string, string> = {
  gold: "#FFD500",
  blue: "#0046AD",
  green: "#009B48",
  purple: "#B71234",
  orange: "#FF9800",
  pink: "#E91E63",
  red: "#F44336",
  cyan: "#00BCD4",
};

interface Cuber {
  id: string;
  name: string;
  display_name: string | null;
  avatar_color: string;
}

interface KidHeaderProps {
  cuberName: string;
  currentCuberId: string;
  cubers: Cuber[];
  onOpenSettings: () => void;
  onOpenSwitcher: () => void;
}

export function KidHeader({ cuberName, currentCuberId, cubers, onOpenSettings, onOpenSwitcher }: KidHeaderProps) {
  const activeCuber = cubers.find((c) => c.id === currentCuberId);
  const avatarColor = AVATAR_HEX[activeCuber?.avatar_color ?? "blue"] ?? "#0046AD";
  const initial = (cuberName?.trim()?.[0] ?? "C").toUpperCase();

  return (
    <header className="relative z-10 flex items-center justify-between gap-3 px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-0.5">
      <button
        onClick={onOpenSwitcher}
        className="group flex items-center gap-2.5 text-left transition-opacity active:opacity-70 [touch-action:manipulation]"
        aria-label="Switch cuber"
      >
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full ring-2 ring-white/15 font-display text-sm font-extrabold"
          style={{ backgroundColor: avatarColor, color: "#fff" }}
        >
          {initial}
        </div>
        <div className="flex items-center gap-1">
          <span className="font-display text-lg font-bold leading-none tracking-tight text-white">
            {cuberName}
          </span>
          <ChevronDown className="size-4 text-white/35" />
        </div>
      </button>

      <button
        onClick={onOpenSettings}
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white [touch-action:manipulation]"
        aria-label="Settings"
      >
        <Settings className="size-[1.05rem]" />
      </button>
    </header>
  );
}
