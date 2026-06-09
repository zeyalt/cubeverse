"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { createCube, deleteCube, setMainCube } from "@/app/actions/cubes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Box, Plus, Star, Trash2 } from "lucide-react";
import { nativeSelectClass, nativeTextareaClass } from "@/lib/ui";
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
    <Button type="submit" disabled={pending}>
      {pending ? "Adding…" : "Add cube"}
    </Button>
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

  return (
    <div className="space-y-8 max-w-3xl">
      {cubes.length === 0 && !showForm && (
        <EmptyState
          icon={Box}
          title="No cubes yet"
          description="Add the puzzles on the gear shelf — mains, backups, and new additions."
        />
      )}

      {/* Cube grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {cubes.map((c) => (
          <div
            key={c.id}
            className={`parent-surface overflow-hidden ${
              c.isMain ? "ring-2 ring-amber-400/50" : ""
            }`}
          >
            <div className="relative flex aspect-square items-center justify-center bg-muted">
              {c.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.photoUrl} alt={c.name} className="w-full h-full object-cover" />
              ) : (
                <Box className="size-12 text-muted-foreground/40" />
              )}
              {c.isMain && (
                <span className="absolute top-2 right-2 bg-amber-400 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 fill-current" />
                  Main
                </span>
              )}
            </div>
            <div className="p-3 space-y-1">
              <p className="text-sm font-semibold leading-tight text-foreground">
                {c.name}
              </p>
              {c.brand && (
                <p className="text-xs text-muted-foreground">{c.brand}</p>
              )}
              {c.eventName && (
                <p className="text-xs text-primary">{c.eventName}</p>
              )}
              <div className="flex gap-1 pt-1">
                {!c.isMain && c.eventId && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(() => setMainCube(c.id, c.eventId))
                    }
                    className="text-[10px] text-amber-600 hover:underline"
                  >
                    Set as main
                  </button>
                )}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => startTransition(() => deleteCube(c.id))}
                  className="ml-auto p-1 text-zinc-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add cube form */}
      {showForm ? (
        <form action={action} className="parent-surface max-w-lg space-y-4 p-5 sm:p-6">
          {state.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" required placeholder="e.g. RS3M 2020" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="brand">Brand</Label>
              <Input id="brand" name="brand" placeholder="e.g. MoYu" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event_id">Event</Label>
              <select
                id="event_id"
                name="event_id"
                className={nativeSelectClass}
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

          <div className="space-y-1.5">
            <Label htmlFor="acquired_on">Acquired</Label>
            <Input id="acquired_on" name="acquired_on" type="date" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              className={nativeTextareaClass}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="photo">Photo</Label>
            <Input id="photo" name="photo" type="file" accept="image/*" />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_main" className="rounded" />
            Main cube for this event
          </label>

          <div className="flex gap-2">
            <SubmitButton />
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" className="gap-1.5" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" />
          Add cube
        </Button>
      )}
    </div>
  );
}
