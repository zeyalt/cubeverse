"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { createCube, deleteCube, setMainCube, updateCube } from "@/app/actions/cubes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Star, Trash2, Edit2, Check, X } from "lucide-react";
import { nativeSelectClass } from "@/lib/ui";
import { EmptyState } from "@/components/ui/empty-state";
import { EventIcon } from "@/components/kid/EventIcon";
import { setEventCookie } from "@/lib/eventCookie";

interface CubeRow {
  id: string;
  name: string;
  brand: string | null;
  eventId: string | null;
  eventName: string | null;
  isMain: boolean;
  photoUrl: string | null;
  acquiredOn: string | null;
  notes: string | null;
}

interface EventOption {
  id: string;
  name: string;
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors [touch-action:manipulation] ${
        active
          ? "border-transparent bg-[#FFD500] text-[#1A1208]"
          : "border-white/20 text-[var(--kid-fg)]/60 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="sticker rounded-lg bg-[#FFD500] px-4 py-2 font-bold text-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
    >
      {pending ? "Adding…" : "Add"}
    </button>
  );
}

export function CubesView({
  cubes,
  events,
  defaultEventId,
}: {
  cubes: CubeRow[];
  events: EventOption[];
  defaultEventId?: string;
}) {
  const [state, action] = useActionState(createCube, { error: null });
  const [showForm, setShowForm] = useState(false);
  // Default to the puzzle selected elsewhere in the app (shared via cookie),
  // but only if it actually has cubes — otherwise show everything.
  const [eventFilter, setEventFilter] = useState<string>(() =>
    defaultEventId && cubes.some((c) => c.eventId === defaultEventId) ? defaultEventId : "all"
  );
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editEvent, setEditEvent] = useState("");
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const startEditing = (cube: CubeRow) => {
    setEditingId(cube.id);
    setEditName(cube.name);
    setEditBrand(cube.brand || "");
    setEditEvent(cube.eventId || "");
    setEditPhoto(null);
    setEditError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  // Puzzle-type filter — show a pill per event that actually has cubes, in the
  // canonical event order, plus a "General" bucket for cubes with no event.
  const eventsWithCubes = events.filter((e) => cubes.some((c) => c.eventId === e.id));
  const hasGeneral = cubes.some((c) => !c.eventId);
  const showFilter = cubes.length > 0 && eventsWithCubes.length + (hasGeneral ? 1 : 0) > 1;
  const visibleCubes = cubes.filter((c) => {
    if (eventFilter === "all") return true;
    if (eventFilter === "general") return !c.eventId;
    return c.eventId === eventFilter;
  });

  return (
    <div className="space-y-4 pb-20">
      {/* Add Cube Button - Always Visible */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="btn-accent flex min-h-11 w-full items-center justify-center gap-2 px-4 [touch-action:manipulation]"
        >
          <Plus className="size-5" />
          Add Cube
        </button>
      )}

      {/* Puzzle-type filter pills */}
      {showFilter && (
        <div className="flex flex-wrap gap-2">
          <FilterPill active={eventFilter === "all"} onClick={() => setEventFilter("all")}>
            All
          </FilterPill>
          {eventsWithCubes.map((e) => (
            <FilterPill
              key={e.id}
              active={eventFilter === e.id}
              onClick={() => {
                setEventFilter(e.id);
                setEventCookie(e.id); // share selection with practice / analytics
              }}
            >
              <EventIcon event={e.id} className="text-base" />
              {e.name}
            </FilterPill>
          ))}
          {hasGeneral && (
            <FilterPill active={eventFilter === "general"} onClick={() => setEventFilter("general")}>
              General
            </FilterPill>
          )}
        </div>
      )}

      {cubes.length === 0 && !showForm && (
        <EmptyState
          icon={Plus}
          title="No cubes yet"
          description="Start building your collection!"
        />
      )}

      {/* Add Cube Form */}
      {showForm && (
        <form action={action} className="sticker rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          {state.error && (
            <p className="text-sm text-red-400 font-bold">{state.error}</p>
          )}

          <div className="space-y-1">
            <Label htmlFor="name" className="text-xs font-bold uppercase text-white/60">Name *</Label>
            <Input id="name" name="name" required placeholder="RS3M 2020" className="bg-white/10 border-white/20 text-[var(--kid-fg)] placeholder:text-[var(--kid-fg-muted)]" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="brand" className="text-xs font-bold uppercase text-white/60">Brand</Label>
              <Input id="brand" name="brand" placeholder="MoYu" className="bg-white/10 border-white/20 text-[var(--kid-fg)] placeholder:text-[var(--kid-fg-muted)]" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="event_id" className="text-xs font-bold uppercase text-white/60">Event</Label>
              <select id="event_id" name="event_id" className={`${nativeSelectClass} bg-white/10 border-white/20 text-[var(--kid-fg)]`}>
                <option value="">General</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="photo" className="text-xs font-bold uppercase text-white/60">Photo</Label>
            <Input id="photo" name="photo" type="file" accept="image/*" className="bg-white/10 border-white/20 text-[var(--kid-fg)] file:bg-white/10 file:border-0 file:text-[var(--kid-fg)] file:font-bold" />
          </div>

          <label className="flex items-center gap-2 text-sm text-white/80">
            <input type="checkbox" name="is_main" className="rounded w-4 h-4" />
            Main cube for this event
          </label>

          <div className="flex gap-2 pt-2">
            <SubmitButton />
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 rounded-lg bg-white/10 px-4 py-2 font-bold text-white transition-colors hover:bg-white/20"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Cubes List */}
      {cubes.length > 0 && (
        <div className="space-y-2">
          {visibleCubes.map((c) => (
            editingId === c.id ? (
              // Edit Mode
              <div
                key={c.id}
                className="sticker rounded-xl border border-[#0046AD] bg-[#0046AD]/5 p-3 space-y-3"
              >
                {editError && (
                  <p className="text-sm text-red-400 font-bold">{editError}</p>
                )}

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-white/60">Name</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-white/10 border-white/20 text-[var(--kid-fg)] placeholder:text-[var(--kid-fg-muted)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold uppercase text-white/60">Brand</Label>
                    <Input
                      value={editBrand}
                      onChange={(e) => setEditBrand(e.target.value)}
                      className="bg-white/10 border-white/20 text-[var(--kid-fg)] placeholder:text-[var(--kid-fg-muted)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold uppercase text-white/60">Event</Label>
                    <select
                      value={editEvent}
                      onChange={(e) => setEditEvent(e.target.value)}
                      className={`${nativeSelectClass} bg-white/10 border-white/20 text-[var(--kid-fg)]`}
                    >
                      <option value="">General</option>
                      {events.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase text-white/60">Photo</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setEditPhoto(e.target.files?.[0] || null)}
                    className="bg-white/10 border-white/20 text-[var(--kid-fg)] file:bg-white/10 file:border-0 file:text-[var(--kid-fg)] file:font-bold"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      startTransition(async () => {
                        const result = await updateCube(
                          c.id,
                          editName,
                          editBrand || null,
                          editEvent || null,
                          editPhoto
                        );
                        if (!result.error) {
                          cancelEditing();
                        } else {
                          setEditError(result.error);
                        }
                      });
                    }}
                    disabled={isPending}
                    className="flex-1 rounded-lg bg-[#009B48] px-4 py-2 font-bold text-white transition-colors hover:bg-[#009B48]/80 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={isPending}
                    className="flex-1 rounded-lg bg-white/10 px-4 py-2 font-bold text-white transition-colors hover:bg-white/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // View Mode
              <div
                key={c.id}
                className={`sticker rounded-xl border transition-all ${
                  c.isMain
                    ? "border-[#FFD500] bg-[#FFD500]/5"
                    : "border-white/10 bg-white/5 hover:bg-white/8"
                }`}
              >
                <div className="flex items-center gap-3 p-3">
                  {/* Cube Photo */}
                  <div className="relative flex-shrink-0 w-12 h-12 rounded-lg bg-white/10 overflow-hidden">
                    {c.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.photoUrl} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/30">
                        📦
                      </div>
                    )}
                    {c.isMain && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent flex items-end justify-center pb-1">
                        <Star className="w-3 h-3 fill-[#FFD500] text-[#FFD500]" />
                      </div>
                    )}
                  </div>

                  {/* Cube Info */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => startEditing(c)}>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white truncate">{c.name}</p>
                      {c.isMain && (
                        <span className="sticker inline-flex items-center gap-1 rounded-full bg-[#FFD500]/20 px-2 py-0.5 text-[10px] font-bold text-[#FFD500] flex-shrink-0">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          Main
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.brand && <span className="text-xs text-white/60">{c.brand}</span>}
                      {c.eventName && (
                        <span className="inline-flex items-center gap-1 text-xs text-[#0046AD] font-bold">
                          {c.eventId && <EventIcon event={c.eventId} className="text-sm" />}
                          {c.eventName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => startEditing(c)}
                      className="p-2 text-white/40 hover:text-[#0046AD] hover:bg-[#0046AD]/10 rounded-lg transition-colors disabled:opacity-50"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {!c.isMain && c.eventId && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(() => setMainCube(c.id, c.eventId))
                        }
                        className="p-2 text-[#FFD500] hover:bg-[#FFD500]/10 rounded-lg transition-colors disabled:opacity-50"
                        title="Set as main"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => startTransition(() => deleteCube(c.id))}
                      className="p-2 text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
