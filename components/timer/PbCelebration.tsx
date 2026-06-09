"use client";

import { useEffect, useRef, useCallback } from "react";
import { toPng } from "html-to-image";
import { Download, X } from "lucide-react";
import { formatCs } from "@/lib/cubing";

interface PbCelebrationProps {
  timeCs: number;
  eventName: string;
  cuberName: string;
  newBadges: string[];
  onDismiss: () => void;
}

function fireConfetti() {
  // Dynamic import keeps canvas-confetti out of the server bundle.
  import("canvas-confetti").then(({ default: confetti }) => {
    confetti({
      particleCount: 160,
      spread: 80,
      origin: { y: 0.5 },
      colors: ["#FFD700", "#FF6B6B", "#4ECDC4", "#A78BFA", "#34D399"],
    });
    // Second burst for extra celebration
    setTimeout(() => {
      confetti({
        particleCount: 80,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
      });
      confetti({
        particleCount: 80,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
      });
    }, 300);
  });
}

export function PbCelebration({
  timeCs,
  eventName,
  cuberName,
  newBadges,
  onDismiss,
}: PbCelebrationProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fireConfetti();
    // Auto-dismiss after 8 seconds
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const downloadCard = useCallback(async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
      const a = document.createElement("a");
      a.download = `pb-${eventName.replace(/\s+/g, "-").toLowerCase()}.png`;
      a.href = dataUrl;
      a.click();
    } catch (err) {
      console.error("Share card generation failed:", err);
    }
  }, [eventName]);

  const formattedTime = formatCs(timeCs);
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm">
        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className="absolute -top-3 -right-3 z-10 p-1.5 rounded-full bg-zinc-800 text-white/60 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Share card (captured as PNG) */}
        <div
          ref={cardRef}
          className="rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-6 text-white"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          <div className="text-xs font-semibold tracking-widest text-white/60 uppercase mb-1">
            Personal Best
          </div>
          <div
            className="font-black tabular-nums leading-none my-3"
            style={{ fontSize: "clamp(3rem, 16vw, 4.5rem)", letterSpacing: "-0.04em" }}
          >
            {formattedTime}
          </div>
          <div className="text-lg font-semibold text-white/90 mb-4">{eventName}</div>
          <div className="flex items-center justify-between text-sm text-white/60">
            <span>{cuberName}</span>
            <span>{today}</span>
          </div>
          <div className="mt-3 text-xs text-white/40 text-right">Cubeverse</div>
        </div>

        {/* Action buttons */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={downloadCard}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors"
          >
            <Download className="w-4 h-4" />
            Save card
          </button>
          <button
            onClick={onDismiss}
            className="flex-1 py-2.5 rounded-xl bg-white text-zinc-900 text-sm font-bold hover:bg-white/90 transition-colors"
          >
            Keep going! 🔥
          </button>
        </div>

        {/* Badge unlocks */}
        {newBadges.length > 0 && (
          <div className="mt-2 px-3 py-2 rounded-xl bg-yellow-500/20 border border-yellow-500/30">
            <p className="text-yellow-300 text-xs font-semibold">
              🏅 {newBadges.length} badge{newBadges.length > 1 ? "s" : ""} unlocked!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
