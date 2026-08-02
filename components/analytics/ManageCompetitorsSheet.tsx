"use client";

import { useRef, useState, useTransition } from "react";
import { X, Plus, Trash2, Loader2 } from "lucide-react";
import {
  addBenchmarkCompetitor,
  removeBenchmarkCompetitor,
  updateBenchmarkCompetitorAlias,
  type SavedCompetitor,
} from "@/app/actions/benchmark";

const WCA_ID_REGEX = /^\d{4}[A-Z]{4}\d{2}$/;

interface Props {
  cuberId: string;
  myWcaId: string;
  saved: SavedCompetitor[];
  colorFor: (wcaId: string) => string;
  onChange: (saved: SavedCompetitor[]) => void;
  onAdded: (id: string) => void;
  onClose: () => void;
}

export function ManageCompetitorsSheet({ cuberId, myWcaId, saved, colorFor, onChange, onAdded, onClose }: Props) {
  const [newId, setNewId] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, startAdd] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [aliasDrafts, setAliasDrafts] = useState<Record<string, string>>({});

  // Drag-to-dismiss, same mechanics as CuberSwitcherSheet.
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartY = useRef(0);

  function onDragStart(clientY: number) {
    dragStartY.current = clientY;
    setDragging(true);
  }
  function onDragMove(clientY: number) {
    if (!dragging) return;
    const delta = clientY - dragStartY.current;
    if (delta > 0) setDragY(delta);
  }
  function onDragEnd() {
    if (!dragging) return;
    setDragging(false);
    if (dragY > 120) onClose();
    else setDragY(0);
  }

  const onAdd = () => {
    const id = newId.trim().toUpperCase();
    if (!WCA_ID_REGEX.test(id)) {
      setAddError("Invalid WCA ID format (e.g. 2015DOEJ01).");
      return;
    }
    if (id === myWcaId.toUpperCase()) {
      setAddError("Enter a different cuber's WCA ID.");
      return;
    }
    setAddError(null);
    startAdd(async () => {
      const res = await addBenchmarkCompetitor(cuberId, id);
      if (res.error) {
        setAddError(res.error);
      } else if (res.competitor) {
        onChange([...saved.filter((c) => c.id !== res.competitor!.id), res.competitor!]);
        onAdded(res.competitor.id); // include the new competitor in the chart right away
        setNewId("");
      }
    });
  };

  const onRemove = async (id: string) => {
    setRemovingId(id);
    onChange(saved.filter((c) => c.id !== id));
    await removeBenchmarkCompetitor(id);
    setRemovingId(null);
  };

  const commitAlias = async (competitor: SavedCompetitor) => {
    const draft = aliasDrafts[competitor.id];
    if (draft === undefined || draft === (competitor.alias ?? "")) return;
    const res = await updateBenchmarkCompetitorAlias(competitor.id, draft);
    if (res.competitor) {
      onChange(saved.map((c) => (c.id === res.competitor!.id ? res.competitor! : c)));
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md" onClick={onClose} />

      <div
        className={`${dragging ? "" : "sheet-enter"} fixed bottom-0 left-0 right-0 z-[101] flex flex-col rounded-t-3xl border-t-2 border-white/15 bg-[#1C1916] px-5 pt-2`}
        style={{
          paddingBottom: "calc(2rem + env(safe-area-inset-bottom))",
          maxHeight: "85vh",
          overflowY: "auto",
          transform: `translateY(${dragY}px)`,
          transition: dragging ? "none" : "transform 0.25s ease",
        }}
      >
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

        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-white">Manage Competitors</h2>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mb-6 space-y-2">
          {saved.length === 0 && (
            <p className="text-sm text-white/40">No competitors enrolled yet.</p>
          )}
          {saved.map((c) => (
            <div
              key={c.id}
              className="sticker flex items-center gap-2 rounded-xl border-2 border-white/10 bg-white/8 px-3 py-2.5"
            >
              <div
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: colorFor(c.wcaId) }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-mono text-white/40">{c.wcaId}</p>
                <input
                  value={aliasDrafts[c.id] ?? c.alias ?? ""}
                  onChange={(e) => setAliasDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  onBlur={() => commitAlias(c)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  placeholder={c.name}
                  className="w-full bg-transparent text-sm font-bold text-white placeholder:text-white/40 focus:outline-none"
                />
              </div>
              <button
                onClick={() => onRemove(c.id)}
                disabled={removingId === c.id}
                aria-label={`Remove ${c.alias ?? c.name}`}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-red-500/15 hover:text-red-400 disabled:opacity-50 [touch-action:manipulation]"
              >
                {removingId === c.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="e.g. 2015DOEJ01"
              disabled={isAdding}
              className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-sm font-mono uppercase text-white placeholder:text-white/30 placeholder:normal-case focus:outline-none focus:border-[#FFD500]/60 disabled:opacity-50"
            />
            <button
              onClick={onAdd}
              disabled={isAdding || !newId.trim()}
              className="btn-accent flex min-h-11 shrink-0 items-center justify-center gap-2 px-4 text-center text-sm [touch-action:manipulation] disabled:opacity-50"
            >
              {isAdding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Add
            </button>
          </div>
          {addError && (
            <p className="text-sm font-medium text-red-400">{addError}</p>
          )}
        </div>
      </div>
    </>
  );
}
