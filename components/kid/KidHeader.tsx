"use client";

import { Settings } from "lucide-react";

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

  return (
    <header className="relative z-10 flex items-start justify-between gap-4 px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <button
        onClick={onOpenSwitcher}
        className="flex items-center gap-3 text-left transition-transform active:scale-95 kid-animate-in"
        aria-label="Switch cuber"
      >
        <div
          className="size-10 shrink-0 rounded-full border-2 border-white/30"
          style={{ backgroundColor: avatarColor }}
        />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
            Cubeverse
          </p>
          <h1 className="font-display mt-1 text-[2.5rem] font-extrabold leading-[0.95] tracking-tight sm:text-5xl">
            {cuberName}
          </h1>
        </div>
      </button>

      <button
        onClick={onOpenSettings}
        className="sticker-ghost mt-1 flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm transition-transform active:scale-95"
        aria-label="Settings"
      >
        <Settings className="size-5" />
      </button>
    </header>
  );
}
