"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { createCube, deleteCube, setMainCube } from "@/app/actions/cubes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Star, Trash2, Edit2, Check, X } from "lucide-react";
import { nativeSelectClass } from "@/lib/ui";
import { EmptyState } from "@/components/ui/empty-state";

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
}: {
  cubes: CubeRow[];
  events: EventOption[];
}) {
  const [state, action] = useActionState(createCube, { error: null });
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4 pb-20">
      {/* Add Cube Button - Always Visible */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="sticker w-full rounded-xl border-2 border-[#FFD500] bg-[#FFD500]/10 px-4 py-3 font-bold text-[#FFD500] transition-all hover:bg-[#FFD500]/20 active:scale-95"
        >
          <Plus className="inline mr-2 size-5" />
          Add Cube
        </button>
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
            <Input id="name" name="name" required placeholder="RS3M 2020" className="bg-white/10 border-white/20 text-white placeholder:text-white/30" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="brand" className="text-xs font-bold uppercase text-white/60">Brand</Label>
              <Input id="brand" name="brand" placeholder="MoYu" className="bg-white/10 border-white/20 text-white placeholder:text-white/30" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="event_id" className="text-xs font-bold uppercase text-white/60">Event</Label>
              <select id="event_id" name="event_id" className={`${nativeSelectClass} bg-white/10 border-white/20 text-white`}>
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
            <Label htmlFor="acquired_on" className="text-xs font-bold uppercase text-white/60">Acquired</Label>
            <Input id="acquired_on" name="acquired_on" type="date" className="bg-white/10 border-white/20 text-white" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes" className="text-xs font-bold uppercase text-white/60">Notes</Label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              placeholder="Add any notes..."
              className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/40"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="photo" className="text-xs font-bold uppercase text-white/60">Photo</Label>
            <Input id="photo" name="photo" type="file" accept="image/*" className="bg-white/10 border-white/20 text-white file:bg-white/10 file:border-0 file:text-white file:font-bold" />
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
          {cubes.map((c) => (
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
                <div className="flex-1 min-w-0">
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
                    {c.eventName && <span className="text-xs text-[#0046AD] font-bold">{c.eventName}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
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
          ))}
        </div>
      )}
    </div>
  );
}
