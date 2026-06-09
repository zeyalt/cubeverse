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
  import("canvas-confetti").then(({ default: confetti }) => {
    confetti({
      particleCount: 180,
      spread: 100,
      origin: { y: 0.55 },
      colors: ["#FFD500", "#0046AD", "#009B48", "#FF5800", "#B71234", "#FFFCF7"],
    });
    setTimeout(() => {
      confetti({ particleCount: 60, angle: 60, spread: 50, origin: { x: 0, y: 0.65 } });
      confetti({ particleCount: 60, angle: 120, spread: 50, origin: { x: 1, y: 0.65 } });
    }, 250);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm kid-animate-in">
        <button
          onClick={onDismiss}
          className="absolute -right-2 -top-2 z-10 rounded-full border-2 border-black bg-[#FFFCF7] p-1.5 text-[#1A1208] shadow-[3px_3px_0_#000]"
        >
          <X className="size-4" />
        </button>

        <div
          ref={cardRef}
          className="sticker overflow-hidden rounded-2xl border-[3px] border-black bg-[#FFFCF7] p-6 text-[#1A1208]"
          style={{ boxShadow: "8px 8px 0 #0A0A0A" }}
        >
          <div className="inline-flex rounded-md bg-[#FFD500] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#1A1200]">
            New PB!
          </div>
          <div
            className="font-mono-time my-4 font-semibold leading-none"
            style={{ fontSize: "clamp(3rem, 16vw, 4.5rem)", letterSpacing: "-0.04em" }}
          >
            {formattedTime}
          </div>
          <div className="font-display text-xl font-bold">{eventName}</div>
          <div className="mt-4 flex items-center justify-between border-t-2 border-[#1A1208]/10 pt-3 text-sm text-[#6B5E4C]">
            <span className="font-semibold text-[#1A1208]">{cuberName}</span>
            <span>{today}</span>
          </div>
          <div className="mt-2 text-right text-[10px] font-bold uppercase tracking-widest text-[#B8860B]">
            Cubeverse
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={downloadCard}
            className="sticker flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FFFCF7] py-3 text-sm font-bold text-[#1A1208]"
          >
            <Download className="size-4" />
            Save card
          </button>
          <button
            onClick={onDismiss}
            className="sticker flex-1 rounded-xl py-3 font-display text-sm font-extrabold"
            style={{ backgroundColor: "#0046AD", color: "#FFF" }}
          >
            Keep going!
          </button>
        </div>

        {newBadges.length > 0 && (
          <div className="sticker mt-2 rounded-xl bg-[#FFD500] px-3 py-2 text-center text-xs font-bold text-[#1A1200]">
            {newBadges.length} badge{newBadges.length > 1 ? "s" : ""} unlocked!
          </div>
        )}
      </div>
    </div>
  );
}
