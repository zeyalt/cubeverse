"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createJournalEntry, deleteJournalEntry } from "@/app/actions/journal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { nativeSelectClass, nativeTextareaClass } from "@/lib/ui";
import { EmptyState } from "@/components/ui/empty-state";

const MOODS = ["😊", "😤", "😴", "🤩", "😅", "💪", "🎉"];

interface Entry {
  id: string;
  title: string | null;
  body: string | null;
  mood: string | null;
  author: string;
  entryDate: string;
  competitionName: string | null;
  photoUrl: string | null;
}

interface CompOption {
  id: string;
  name: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save entry"}
    </Button>
  );
}

export function JournalView({
  entries,
  competitions,
}: {
  entries: Entry[];
  competitions: CompOption[];
}) {
  const [state, action] = useActionState(createJournalEntry, { error: null });
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-8 max-w-2xl">
      {entries.length === 0 && !showForm && (
        <EmptyState
          icon={BookOpen}
          title="No entries yet"
          description="Capture a competition memory or a practice day reflection."
        />
      )}

      {/* Entry list */}
      <div className="space-y-4">
        {entries.map((e) => (
          <article
            key={e.id}
            className="parent-surface overflow-hidden"
          >
            {e.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={e.photoUrl}
                alt=""
                className="w-full h-48 object-cover"
              />
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {e.mood && <span className="text-xl">{e.mood}</span>}
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.entryDate).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {" · "}
                      {e.author === "child" ? "Child" : "Parent"}
                    </span>
                  </div>
                  {e.title && (
                    <h3 className="font-semibold text-foreground">
                      {e.title}
                    </h3>
                  )}
                  {e.competitionName && (
                    <p className="mt-0.5 text-xs text-primary">{e.competitionName}</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => startTransition(() => deleteJournalEntry(e.id))}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {e.body && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {e.body}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>

      {/* New entry form */}
      {showForm ? (
        <form action={action} className="parent-surface space-y-4 p-5 sm:p-6">
          {state.error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="entry_date">Date</Label>
              <Input
                id="entry_date"
                name="entry_date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="author">Author</Label>
              <select
                id="author"
                name="author"
                className={nativeSelectClass}
              >
                <option value="parent">Parent</option>
                <option value="child">Child</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Mood</Label>
            <div className="flex gap-2 flex-wrap">
              {MOODS.map((m) => (
                <label key={m} className="cursor-pointer">
                  <input type="radio" name="mood" value={m} className="sr-only peer" />
                  <span className="text-2xl p-1.5 rounded-lg border border-transparent peer-checked:border-indigo-400 peer-checked:bg-indigo-50 dark:peer-checked:bg-indigo-950/30 inline-block hover:scale-110 transition-transform">
                    {m}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">Title (optional)</Label>
            <Input id="title" name="title" placeholder="e.g. First podium!" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="body">Reflection</Label>
            <textarea
              id="body"
              name="body"
              rows={4}
              placeholder="What happened? How did it feel?"
              className={nativeTextareaClass}
            />
          </div>

          {competitions.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="competition_id">Link to competition (optional)</Label>
              <select
                id="competition_id"
                name="competition_id"
                className={nativeSelectClass}
              >
                <option value="">None</option>
                {competitions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="photo">Photo (optional)</Label>
            <Input id="photo" name="photo" type="file" accept="image/*" />
          </div>

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
          New entry
        </Button>
      )}
    </div>
  );
}
