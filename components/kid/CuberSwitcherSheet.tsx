"use client";

import { useRef, useState, useTransition } from "react";
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

  // Drag-to-dismiss / drag-to-expand state
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const dragStartY = useRef(0);

  function handleSwitch(cuberId: string) {
    if (cuberId === currentCuberId) {
      onClose();
      return;
    }
    startTransition(() => switchCuber(cuberId));
  }

  function onDragStart(clientY: number) {
    dragStartY.current = clientY;
    setDragging(true);
  }

  function onDragMove(clientY: number) {
    if (!dragging) return;
    const delta = clientY - dragStartY.current;
    // Allow dragging down (positive). Negative drag (up) expands the sheet.
    if (delta < 0) {
      setExpanded(true);
      setDragY(0);
    } else {
      setDragY(delta);
    }
  }

  function onDragEnd() {
    if (!dragging) return;
    setDragging(false);
    // If dragged down more than 120px, dismiss
    if (dragY > 120) {
      onClose();
    } else {
      setDragY(0);
    }
  }

  return (
    <>
      {/* Backdrop — opaque-ish, fully blocks content behind */}
      <div
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Sheet panel */}
      <div
        className={`${dragging ? "" : "sheet-enter"} fixed bottom-0 left-0 right-0 z-[101] flex flex-col rounded-t-3xl border-t-2 border-white/15 bg-[#1C1916] px-5 pt-2`}
        style={{
          paddingBottom: "calc(5rem + 1.5rem + env(safe-area-inset-bottom))",
          height: expanded ? "92vh" : "auto",
          maxHeight: "92vh",
          overflowY: "auto",
          transform: `translateY(${dragY}px)`,
          transition: dragging ? "none" : "transform 0.25s ease, height 0.25s ease",
        }}
      >
        {/* Draggable handle area */}
        <div
          className="-mx-5 px-5 pb-2 pt-2 cursor-grab active:cursor-grabbing touch-none"
          style={{ touchAction: "none" }}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onDragStart(e.clientY); }}
          onPointerMove={(e) => onDragMove(e.clientY)}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <div className="mx-auto h-1.5 w-12 rounded-full bg-white/25" />
        </div>

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
