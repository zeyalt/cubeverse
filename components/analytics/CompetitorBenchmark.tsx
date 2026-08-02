"use client";

import { useState, useEffect, useTransition } from "react";
import { Loader2, Plus, X } from "lucide-react";
import {
  listBenchmarkCompetitors,
  addBenchmarkCompetitor,
  removeBenchmarkCompetitor,
  getBenchmarkSeries,
  type SavedCompetitor,
  type BenchmarkPerson,
} from "@/app/actions/benchmark";
import { CompetitorProgressChart } from "./CompetitorProgressChart";
import { COMPETITOR_PALETTE } from "@/lib/chartTheme";

const WCA_ID_REGEX = /^\d{4}[A-Z]{4}\d{2}$/;

interface Props {
  cuberId: string;
  myWcaId: string | null;
  eventId: string;
}

export function CompetitorBenchmark({ cuberId, myWcaId, eventId }: Props) {
  const [saved, setSaved] = useState<SavedCompetitor[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newId, setNewId] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, startAdd] = useTransition();

  const [mode, setMode] = useState<"single" | "average">("single");
  const [people, setPeople] = useState<BenchmarkPerson[] | null>(null);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [isLoadingSeries, startLoadSeries] = useTransition();

  useEffect(() => {
    if (!myWcaId) return;
    listBenchmarkCompetitors(cuberId).then(setSaved);
  }, [cuberId, myWcaId]);

  // Order here is the saved list's insertion order (filtered to selected) —
  // this exact order is what's sent to getBenchmarkSeries and is what the
  // chart colors its lines by, so pill color (chartIdx below) stays in sync
  // with line color. The sorted key is only for the effect's dependency
  // check, never passed to the action, so re-selecting in a different order
  // doesn't reorder (and re-color) an unrelated chart.
  const selectedWcaIds = saved.filter((c) => selectedIds.has(c.id)).map((c) => c.wcaId);
  const selectedKey = [...selectedWcaIds].sort().join(",");

  useEffect(() => {
    startLoadSeries(async () => {
      if (!myWcaId || !selectedKey) {
        setPeople(null);
        setSeriesError(null);
        return;
      }
      const res = await getBenchmarkSeries(myWcaId, selectedWcaIds, eventId);
      if (res.error) {
        setSeriesError(res.error);
        setPeople(null);
      } else {
        setSeriesError(null);
        setPeople(res.people);
      }
    });
    // selectedWcaIds intentionally omitted: selectedKey (its sorted contents)
    // is the real dependency — refetching on every reorder of the same set
    // would just replay the identical request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myWcaId, eventId, selectedKey]);

  const onAdd = () => {
    if (!myWcaId) return;
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
        setSaved((prev) => [...prev.filter((c) => c.id !== res.competitor!.id), res.competitor!]);
        setSelectedIds((prev) => new Set(prev).add(res.competitor!.id));
        setNewId("");
      }
    });
  };

  const onToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onRemove = async (id: string) => {
    setSaved((prev) => prev.filter((c) => c.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    await removeBenchmarkCompetitor(id);
  };

  if (!myWcaId) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
        No WCA ID found. Please set it in your profile.
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
          {addError}
        </div>
      )}

      {saved.length === 0 ? (
        <p className="text-sm text-white/40">Add a cuber&apos;s WCA ID above to start comparing.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {saved.map((c) => {
            // +1 offset: index 0 in the chart's palette is always "You".
            const chartIdx = 1 + selectedWcaIds.indexOf(c.wcaId);
            const isSelected = selectedIds.has(c.id);
            const color = COMPETITOR_PALETTE[(isSelected ? chartIdx : 0) % COMPETITOR_PALETTE.length];
            return (
              <span
                key={c.id}
                className="inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-bold transition-transform active:scale-95"
                style={
                  isSelected
                    ? { backgroundColor: color, color: "#0A0A0A", borderColor: "#0A0A0A" }
                    : { borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.6)" }
                }
              >
                <button onClick={() => onToggle(c.id)}>{c.name}</button>
                <button onClick={() => onRemove(c.id)} className="opacity-70 hover:opacity-100">
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {saved.length > 0 && selectedIds.size === 0 && (
        <p className="text-sm text-white/40">Select at least one cuber above to see the comparison.</p>
      )}

      {selectedIds.size > 0 && (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            {(["single", "average"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setMode(t)}
                className={`px-3 py-1 rounded-full border font-bold transition-colors ${
                  mode === t
                    ? "bg-[#FFD500] text-[#1A1208] border-transparent"
                    : "border-white/20 text-white/50 hover:bg-white/10"
                }`}
              >
                {t === "single" ? "Single" : "Average"}
              </button>
            ))}
          </div>

          {seriesError && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
              {seriesError}
            </div>
          )}

          {isLoadingSeries && !people && (
            <div className="flex h-[200px] items-center justify-center">
              <Loader2 className="size-6 animate-spin text-white/40" />
            </div>
          )}

          {people && (
            <div className="surface px-2 py-3">
              <CompetitorProgressChart people={people} mode={mode} />
              {people.some((p) => p.error) && (
                <div className="mt-2 space-y-1 px-2">
                  {people.filter((p) => p.error).map((p) => (
                    <p key={p.wcaId} className="text-xs text-red-400">
                      {p.name}: {p.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
