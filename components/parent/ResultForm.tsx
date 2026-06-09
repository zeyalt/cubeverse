"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { addResult } from "@/app/actions/competition";
import { parseToCs, effectiveTime, wcaAverage, formatCs, DNF } from "@/lib/cubing";
import type { Penalty } from "@/lib/cubing";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";

interface Event {
  id: string;
  name: string;
  format: string;
}

interface Props {
  competitionId: string;
  competitionName: string;
  events: Event[];
}

type SolveInput = { timeStr: string; penalty: Penalty };

const ROUND_TYPES = [
  { value: "first",  label: "First round" },
  { value: "second", label: "Second round" },
  { value: "semi",   label: "Semi-final" },
  { value: "final",  label: "Final" },
];

const PENALTY_LABELS: Record<Penalty, string> = {
  none: "OK",
  plus2: "+2",
  dnf: "DNF",
  dns: "DNS",
};

function solveSlots(format: string): number {
  if (format === "ao5") return 5;
  if (format === "mo3" || format === "bo3") return 3;
  return 1; // bo1
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save result"}
    </Button>
  );
}

export function ResultForm({ competitionId, competitionName, events }: Props) {
  const [state, action] = useActionState(addResult, { error: null });
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id ?? "333");
  const [roundType, setRoundType] = useState("final");
  const [solves, setSolves] = useState<SolveInput[]>(
    Array(5).fill(null).map(() => ({ timeStr: "", penalty: "none" as Penalty }))
  );

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const format = selectedEvent?.format ?? "ao5";
  const slots = solveSlots(format);

  function updateSolve(i: number, patch: Partial<SolveInput>) {
    setSolves((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  // Live preview
  const activeSolves = solves.slice(0, slots);
  const effTimes = activeSolves.map((s) => {
    if (s.penalty === "dnf" || s.penalty === "dns") return DNF;
    if (!s.timeStr.trim()) return null;
    const cs = parseToCs(s.timeStr);
    if (!cs || cs <= 0) return null;
    return effectiveTime(cs, s.penalty);
  });

  const allFilled = effTimes.every((t) => t !== null);
  const validEff = effTimes.filter((t) => t !== null) as number[];
  const nonDnf = validEff.filter((t) => t !== DNF);
  const previewBest = nonDnf.length > 0 ? Math.min(...nonDnf) : validEff.length > 0 ? DNF : null;
  const previewAvg =
    allFilled &&
    ((format === "ao5" && validEff.length === 5) ||
      (format === "mo3" && validEff.length === 3))
      ? wcaAverage(validEff)
      : null;

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/parent/competitions/${competitionId}`}
          className="p-1.5 -m-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Add result
          </h2>
          <p className="text-sm text-zinc-500">{competitionName}</p>
        </div>
      </div>

      <form action={action} className="space-y-5">
        <input type="hidden" name="competition_id" value={competitionId} />
        <input type="hidden" name="event_id" value={selectedEventId} />
        <input type="hidden" name="round_type" value={roundType} />

        {state.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}

        {/* Event + Round */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Event</Label>
            <Select value={selectedEventId} onValueChange={(v) => v && setSelectedEventId(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {events.map((ev) => (
                  <SelectItem key={ev.id} value={ev.id}>
                    {ev.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Round</Label>
            <Select value={roundType} onValueChange={(v) => v && setRoundType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROUND_TYPES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Solve entries */}
        <div className="space-y-2">
          <Label>Solve times</Label>
          {Array.from({ length: slots }, (_, i) => {
            const solve = solves[i];
            const isDnf = solve.penalty === "dnf" || solve.penalty === "dns";
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 text-center text-sm text-zinc-400 shrink-0">
                  {i + 1}
                </span>
                <Input
                  name={`time_${i + 1}`}
                  value={solve.timeStr}
                  onChange={(e) => updateSolve(i, { timeStr: e.target.value })}
                  placeholder="e.g. 12.34"
                  disabled={isDnf}
                  className={`flex-1 font-mono ${isDnf ? "opacity-40" : ""}`}
                />
                {/* Hidden penalty for form submission */}
                <input type="hidden" name={`penalty_${i + 1}`} value={solve.penalty} />
                {/* Penalty buttons */}
                {(["none", "plus2", "dnf"] as Penalty[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() =>
                      updateSolve(i, {
                        penalty: p,
                        timeStr: p === "dnf" ? "" : solve.timeStr,
                      })
                    }
                    className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                      solve.penalty === p
                        ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {PENALTY_LABELS[p]}
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* Live preview */}
        {(previewBest !== null || previewAvg !== null) && (
          <div className="flex gap-6 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm">
            {previewBest !== null && (
              <div>
                <span className="text-zinc-400 text-xs block mb-0.5">Best</span>
                <span className="font-bold font-mono">
                  {previewBest === DNF ? "DNF" : formatCs(previewBest)}
                </span>
              </div>
            )}
            {previewAvg !== null && (
              <div>
                <span className="text-zinc-400 text-xs block mb-0.5">
                  {format === "ao5" ? "Ao5" : "Mo3"}
                </span>
                <span className="font-bold font-mono">
                  {previewAvg === DNF ? "DNF" : formatCs(previewAvg)}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <SubmitButton />
          <Link href={`/parent/competitions/${competitionId}`} className={cn(buttonVariants({ variant: "outline" }))}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
