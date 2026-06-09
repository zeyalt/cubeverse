"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { createGoal, seedStarterGoals, archiveGoal } from "@/app/actions/goals";
import { goalProgress } from "@/lib/goals";
import { formatCs } from "@/lib/cubing";
import { nativeSelectClass } from "@/lib/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Archive, Plus, Sparkles } from "lucide-react";

interface GoalRow {
  id: string;
  eventId: string;
  eventName: string;
  recordType: "single" | "average";
  targetCs: number;
  targetDate: string | null;
  status: string;
  achievedAt: string | null;
  currentCs: number | null;
}

interface EventOption {
  id: string;
  name: string;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-[#0046AD] transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

export function GoalsView({
  goals,
  events,
  hasGoals,
}: {
  goals: GoalRow[];
  events: EventOption[];
  hasGoals: boolean;
}) {
  const [createState, createAction] = useActionState(createGoal, { error: null });
  const [seedState, setSeedState] = useState<{ error: string | null; success?: string }>({
    error: null,
  });
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSeed() {
    startTransition(async () => {
      const result = await seedStarterGoals();
      setSeedState(result);
    });
  }

  const active = goals.filter((g) => g.status === "active");
  const achieved = goals.filter((g) => g.status === "achieved");

  return (
    <div className="space-y-8 max-w-2xl">
      {!hasGoals && (
        <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-5">
          <p className="mb-3 text-sm text-muted-foreground">
            No goals yet. Load starter targets or add your own.
          </p>
          <div>
            {seedState.error && (
              <p className="mb-2 text-sm text-red-600">{seedState.error}</p>
            )}
            {seedState.success && (
              <p className="mb-2 text-sm text-emerald-600">{seedState.success}</p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isPending}
              onClick={handleSeed}
            >
              <Sparkles className="size-3.5" />
              {isPending ? "Loading…" : "Load starter goals"}
            </Button>
          </div>
        </div>
      )}

      {active.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Active · {active.length}
          </h3>
          {active.map((g) => {
            const pct = goalProgress(g.currentCs, g.targetCs);
            return (
              <div key={g.id} className="parent-surface space-y-3 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">
                      {g.eventName}{" "}
                      <span className="font-normal text-muted-foreground">
                        {g.recordType === "single" ? "single" : "average"}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Target{" "}
                      <span className="font-mono-time font-medium text-foreground">
                        {formatCs(g.targetCs)}
                      </span>
                      {g.currentCs && (
                        <>
                          {" · "}Current{" "}
                          <span className="font-mono-time font-medium text-foreground">
                            {formatCs(g.currentCs)}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => startTransition(() => archiveGoal(g.id))}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Archive goal"
                  >
                    <Archive className="size-4" />
                  </button>
                </div>
                <ProgressBar pct={pct} />
                <p className="text-xs text-muted-foreground">{pct}% toward target</p>
              </div>
            );
          })}
        </section>
      )}

      {achieved.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Achieved · {achieved.length}
          </h3>
          {achieved.map((g) => (
            <div
              key={g.id}
              className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20"
            >
              <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                ✓ {g.eventName} {g.recordType} — {formatCs(g.targetCs)}
              </p>
              {g.achievedAt && (
                <p className="mt-0.5 text-xs text-emerald-600/80">
                  {new Date(g.achievedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {showForm ? (
        <form action={createAction} className="parent-surface space-y-4 p-5">
          {createState.error && (
            <p className="text-sm text-red-600">{createState.error}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="event_id">Event</Label>
              <select id="event_id" name="event_id" required className={nativeSelectClass}>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="record_type">Type</Label>
              <select id="record_type" name="record_type" required className={nativeSelectClass}>
                <option value="single">Single (best)</option>
                <option value="average">Average</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="target">Target time</Label>
              <Input id="target" name="target" required placeholder="e.g. 15.00" className="font-mono-time" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target_date">Target date (optional)</Label>
              <Input id="target_date" name="target_date" type="date" />
            </div>
          </div>
          <div className="flex gap-2">
            <SubmitButton label="Add goal" />
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowForm(true)}>
          <Plus className="size-3.5" />
          Add goal
        </Button>
      )}
    </div>
  );
}
