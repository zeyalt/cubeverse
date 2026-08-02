"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { Loader2, Settings, RefreshCw } from "lucide-react";
import {
  listBenchmarkCompetitors,
  getBenchmarkSeries,
  type SavedCompetitor,
  type BenchmarkPerson,
} from "@/app/actions/benchmark";
import { CompetitorProgressChart } from "./CompetitorProgressChart";
import { ManageCompetitorsSheet } from "./ManageCompetitorsSheet";
import { COMPETITOR_PALETTE } from "@/lib/chartTheme";

interface Props {
  cuberId: string;
  myWcaId: string | null;
  eventId: string;
  eventName: string;
}

export function CompetitorBenchmark({ cuberId, myWcaId, eventId, eventName }: Props) {
  const [saved, setSaved] = useState<SavedCompetitor[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [manageOpen, setManageOpen] = useState(false);

  const [mode, setMode] = useState<"single" | "average">("single");
  const [people, setPeople] = useState<BenchmarkPerson[] | null>(null);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [isLoadingSeries, startLoadSeries] = useTransition();
  // Bumped by the Update button to force a refetch even when nothing in the
  // effect's other dependencies changed — results are fetched live from the
  // WCA API, so a competitor may have new results since the last fetch.
  const [refreshNonce, setRefreshNonce] = useState(0);
  // Guards against a slower response for an earlier event/selection landing
  // after a later one and overwriting it — same out-of-order hazard as
  // eventSwitchGen in KidPracticeTab and fetchGen in KidModeShell. Without
  // this, rapidly toggling events (e.g. 3x3 -> 2x2 -> 3x3) could show a stale
  // chart or nothing at all, depending on which request happened to resolve
  // last.
  const fetchGen = useRef(0);

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
    const gen = ++fetchGen.current;
    startLoadSeries(async () => {
      if (!myWcaId || !selectedKey) {
        if (gen !== fetchGen.current) return; // superseded
        setPeople(null);
        setSeriesError(null);
        return;
      }
      const res = await getBenchmarkSeries(myWcaId, selectedWcaIds, eventId, cuberId);
      if (gen !== fetchGen.current) return; // superseded by a later change
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
  }, [myWcaId, eventId, selectedKey, cuberId, refreshNonce]);

  // +1 offset: index 0 in the chart's palette is always "You". Used both for
  // pill colors here and passed into the Manage sheet so swatches match.
  const colorFor = (wcaId: string) => {
    const idx = selectedWcaIds.indexOf(wcaId);
    return COMPETITOR_PALETTE[(idx === -1 ? 0 : idx + 1) % COMPETITOR_PALETTE.length];
  };

  const onToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
      <div className="flex items-center justify-between gap-2">
        {saved.length === 0 ? (
          <p className="text-sm text-white/40">Add a cuber&apos;s WCA ID to start comparing.</p>
        ) : (
          <div className="flex flex-1 flex-wrap gap-2">
            {saved.map((c) => {
              const isSelected = selectedIds.has(c.id);
              const color = colorFor(c.wcaId);
              return (
                <button
                  key={c.id}
                  onClick={() => onToggle(c.id)}
                  className="rounded-full border-2 px-3 py-1.5 text-xs font-bold transition-transform active:scale-95"
                  style={
                    isSelected
                      ? { backgroundColor: color, color: "#0A0A0A", borderColor: "#0A0A0A" }
                      : { borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.6)" }
                  }
                >
                  {c.alias || c.name}
                </button>
              );
            })}
          </div>
        )}
        <button
          onClick={() => setManageOpen(true)}
          aria-label="Manage competitors"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
        >
          <Settings className="size-4" />
        </button>
      </div>

      {saved.length > 0 && selectedIds.size === 0 && (
        <p className="text-sm text-white/40">Select at least one cuber above to see the comparison.</p>
      )}

      {selectedIds.size > 0 && (
        <>
          <div className="flex items-center justify-between gap-2">
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
            <button
              onClick={() => setRefreshNonce((n) => n + 1)}
              disabled={isLoadingSeries}
              className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1 text-xs font-bold text-white/60 transition-colors hover:bg-white/10 disabled:opacity-50 [touch-action:manipulation]"
            >
              <RefreshCw className={`size-3 ${isLoadingSeries ? "animate-spin" : ""}`} />
              Update
            </button>
          </div>

          <p className="text-xs text-white/40">Comparing {eventName}</p>

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

      {manageOpen && (
        <ManageCompetitorsSheet
          cuberId={cuberId}
          myWcaId={myWcaId}
          saved={saved}
          colorFor={colorFor}
          onChange={setSaved}
          onAdded={(id) => setSelectedIds((prev) => new Set(prev).add(id))}
          onClose={() => setManageOpen(false)}
        />
      )}
    </div>
  );
}
