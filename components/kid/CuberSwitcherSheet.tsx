"use client";

import { useTransition } from "react";
import Link from "next/link";
import { switchCuber } from "@/app/actions/onboarding";
import { X, Plus } from "lucide-react";

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

interface CuberSwitcherSheetProps {
  cubers: Cuber[];
  currentCuberId: string;
  onClose: () => void;
}

export function CuberSwitcherSheet({
  cubers,
  currentCuberId,
  onClose,
}: CuberSwitcherSheetProps) {
  const [isPending, startTransition] = useTransition();

  function handleSwitch(cuberId: string) {
    if (cuberId === currentCuberId) {
      onClose();
      return;
    }
    startTransition(() => switchCuber(cuberId));
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet panel */}
      <div
        className="sheet-enter fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl border-t-2 border-white/10 bg-[#1C1916] px-5 pt-4"
        style={{
          paddingBottom: "calc(5rem + 1.5rem + env(safe-area-inset-bottom))",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Handle bar */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-white">Switch Cuber</h2>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Cubers list */}
        <div className="space-y-2 mb-6">
          {cubers.map((cuber) => {
            const isActive = cuber.id === currentCuberId;
            const color = AVATAR_HEX[cuber.avatar_color] ?? "#0046AD";
            return (
              <button
                key={cuber.id}
                onClick={() => handleSwitch(cuber.id)}
                disabled={isPending}
                className="sticker w-full flex items-center gap-3 rounded-xl border-2 border-white/10 bg-white/8 px-4 py-3 transition-all hover:bg-white/12 disabled:opacity-50"
                style={{
                  boxShadow: isActive ? `0 0 0 3px #FFD500` : "2px 2px 0 rgba(0,0,0,0.2)",
                }}
              >
                <div
                  className="size-8 shrink-0 rounded-full border-2"
                  style={{
                    backgroundColor: color,
                    borderColor: isActive ? "#FFD500" : "rgba(255,255,255,0.2)",
                  }}
                />
                <span className="flex-1 text-left font-medium text-white">
                  {cuber.display_name ?? cuber.name}
                </span>
                {isActive && (
                  <span className="text-sm font-bold text-[#FFD500]">✓</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Add cuber button */}
        <Link
          href="/onboarding/name"
          className="sticker flex items-center justify-center gap-2 rounded-xl border-2 border-white/20 bg-white/10 px-4 py-3 font-bold text-white transition-all hover:bg-white/15"
        >
          <Plus className="size-5" />
          Add new cuber
        </Link>
      </div>
    </>
  );
}
