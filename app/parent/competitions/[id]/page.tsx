import { notFound } from "next/navigation";
import Link from "next/link";
import { getServiceClient } from "@/lib/supabase/service";
import { formatCs, DNF } from "@/lib/cubing";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteCompetition, deleteResult } from "@/app/actions/competition";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

const ROUND_LABELS: Record<string, string> = {
  first: "R1", second: "R2", semi: "Semi", final: "Final",
};

const EVENT_NAMES: Record<string, string> = {
  "333": "3×3×3", "222": "2×2×2", "444": "4×4×4", "555": "5×5×5",
  "666": "6×6×6", "777": "7×7×7", pyram: "Pyraminx", skewb: "Skewb",
  clock: "Clock", minx: "Megaminx", sq1: "Square-1",
  "333oh": "3×3 OH", "333bf": "3×3 BLD",
};

function fmtTime(cs: number | null): string {
  if (cs === null) return "—";
  if (cs === DNF) return "DNF";
  return formatCs(cs);
}

export default async function CompetitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getServiceClient();

  const { data: comp } = await db
    .from("competitions")
    .select("id, name, type, city, country, start_date, end_date")
    .eq("id", id)
    .maybeSingle();

  if (!comp) notFound();

  const { data: results } = await db
    .from("results")
    .select(`
      id, event_id, round_type, format, best_cs, average_cs,
      solves ( id, time_cs, penalty, position )
    `)
    .eq("competition_id", id)
    .order("created_at");

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            href="/parent/competitions"
            className="p-1.5 -m-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors mt-1"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {comp.name}
              </h2>
              <Badge variant={comp.type === "wca" ? "default" : "secondary"}>
                {comp.type === "wca" ? "WCA" : "Unofficial"}
              </Badge>
            </div>
            {(comp.city || comp.country || comp.start_date) && (
              <p className="text-sm text-zinc-500 mt-0.5">
                {[comp.city, comp.country].filter(Boolean).join(", ")}
                {comp.start_date && (
                  <span className="ml-2">
                    {comp.start_date}
                    {comp.end_date && comp.end_date !== comp.start_date
                      ? ` – ${comp.end_date}`
                      : ""}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/parent/competitions/${id}/result/new`} className={cn(buttonVariants({ size: "sm" }))}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add result
          </Link>
          {comp.type !== "wca" && (
            <form
              action={deleteCompetition}
              onSubmit={(e) => {
                if (!confirm(`Delete "${comp.name}"? This cannot be undone.`))
                  e.preventDefault();
              }}
            >
              <input type="hidden" name="competition_id" value={id} />
              <Button type="submit" variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* Results */}
      {!results?.length && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 py-12 text-center text-zinc-400">
          <p className="text-sm">No results yet.</p>
          <p className="text-xs mt-1">Click &ldquo;Add result&rdquo; to enter your first event.</p>
        </div>
      )}

      <div className="space-y-4">
        {results?.map((result) => {
          const solvesSorted = [...(result.solves as {
            id: string; time_cs: number; penalty: string; position: number;
          }[])].sort((a, b) => a.position - b.position);

          return (
            <div
              key={result.id}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
            >
              {/* Result header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {EVENT_NAMES[result.event_id] ?? result.event_id}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {ROUND_LABELS[result.round_type] ?? result.round_type}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-xs text-zinc-400 block">Best</span>
                    <span className="font-mono font-semibold text-sm">
                      {fmtTime(result.best_cs)}
                    </span>
                  </div>
                  {result.average_cs !== null && result.format !== "bo3" && (
                    <div className="text-right">
                      <span className="text-xs text-zinc-400 block">
                        {result.format === "ao5" ? "Ao5" : "Mo3"}
                      </span>
                      <span className="font-mono font-semibold text-sm">
                        {fmtTime(result.average_cs)}
                      </span>
                    </div>
                  )}
                  {comp.type !== "wca" && (
                    <form action={deleteResult}>
                      <input type="hidden" name="result_id" value={result.id} />
                      <input type="hidden" name="competition_id" value={id} />
                      <button
                        type="submit"
                        className="text-zinc-300 hover:text-red-400 transition-colors p-1"
                        title="Delete result"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* Individual solves */}
              {solvesSorted.length > 0 && (
                <div className="px-4 py-3 flex gap-3 flex-wrap">
                  {solvesSorted.map((solve) => {
                    const penalty = solve.penalty as string;
                    const isDnf = penalty === "dnf" || penalty === "dns";
                    const isPlus2 = penalty === "plus2";
                    const displayTime = isDnf
                      ? penalty.toUpperCase()
                      : isPlus2
                      ? formatCs(solve.time_cs + 200) + "+"
                      : formatCs(solve.time_cs);
                    return (
                      <span
                        key={solve.id}
                        className={`font-mono text-sm ${
                          isDnf ? "text-red-500" : "text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {displayTime}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
