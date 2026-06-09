import Link from "next/link";
import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { getCurrentPbs, getHeatmapCounts } from "@/lib/analytics";
import { formatCs } from "@/lib/cubing";
import { PracticeHeatmap } from "@/components/analytics/PracticeHeatmap";
import { PageHeader } from "@/components/parent/PageHeader";
import { TrendingUp } from "lucide-react";

const EVENT_NAMES: Record<string, string> = {
  "333": "3×3×3", "222": "2×2×2", "444": "4×4×4",
  pyram: "Pyraminx", skewb: "Skewb", clock: "Clock", "333oh": "3×3 OH",
};

const ACTIVE_EVENTS = ["333", "222", "pyram", "skewb", "clock", "444", "333oh"];

function fmt(cs: number | null): string {
  if (cs === null) return "—";
  if (cs <= 0) return "DNF";
  return formatCs(cs);
}

function DeltaBadge({ official, practice }: { official: number | null; practice: number | null }) {
  if (!official || !practice || practice >= official) return null;
  const delta = official - practice;
  return (
    <span className="ml-1 text-xs font-medium text-[#009B48]">
      ↑{formatCs(delta)}
    </span>
  );
}

export default async function OverviewPage() {
  const db = getServiceClient();
  const ownerId = getOwnerId();

  const { data: settings } = await db
    .from("app_settings")
    .select("default_cuber_id")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!settings) return <p className="text-muted-foreground text-sm">Run setup first.</p>;
  const cuberId = settings.default_cuber_id as string;

  const [pbs, heatmap] = await Promise.all([
    getCurrentPbs(db, cuberId, ACTIVE_EVENTS),
    getHeatmapCounts(db, cuberId),
  ]);

  const totalSolves = Object.values(heatmap).reduce((a, b) => a + b, 0);

  // Find best practice time across all events for callout
  const allPracticeSingles = pbs
    .map((p) => p.practiceSingle)
    .filter((p) => p && p > 0) as number[];
  const bestOverall = allPracticeSingles.length > 0 ? Math.min(...allPracticeSingles) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="Current personal bests and practice rhythm at a glance."
      />

      {/* Top stat callout */}
      {bestOverall && (
        <div className="page-enter relative overflow-hidden rounded-2xl border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 p-6 shadow-lg">
          <div className="absolute inset-0 opacity-5 pointer-events-none">
            <svg className="absolute top-0 right-0 w-96 h-96" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.1" />
            </svg>
          </div>
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1">
              Personal best overall
            </p>
            <p className="font-display text-5xl font-bold text-blue-900 dark:text-blue-100">
              {formatCs(bestOverall)}
            </p>
          </div>
        </div>
      )}

      <section className="parent-surface overflow-hidden">
        <div className="parent-surface-header">
          <h2 className="font-semibold text-foreground">Personal bests</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Event
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Official
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Off. avg
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Practice
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Prac. avg
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {pbs.map((row, i) => (
                <tr
                  key={row.eventId}
                  className={i < pbs.length - 1 ? "border-b border-border/70" : ""}
                >
                  <td className="px-5 py-3.5 font-semibold text-foreground">
                    {EVENT_NAMES[row.eventId] ?? row.eventId}
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono-time text-foreground/85">
                    {fmt(row.officialSingle)}
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono-time text-foreground/85">
                    {fmt(row.officialAvg)}
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono-time text-foreground/85">
                    {fmt(row.practiceSingle)}
                    <DeltaBadge official={row.officialSingle} practice={row.practiceSingle} />
                  </td>
                  <td className="px-4 py-3.5 text-center font-mono-time text-foreground/85">
                    {fmt(row.practiceAvg)}
                    <DeltaBadge official={row.officialAvg} practice={row.practiceAvg} />
                  </td>
                  <td className="px-2">
                    <Link
                      href={`/parent/event/${row.eventId}`}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                      title={`Analytics for ${EVENT_NAMES[row.eventId] ?? row.eventId}`}
                    >
                      <TrendingUp className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="parent-surface p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-foreground">Practice activity</h2>
          <span className="text-xs text-muted-foreground">
            {totalSolves} solve{totalSolves !== 1 ? "s" : ""} in the last year
          </span>
        </div>
        <PracticeHeatmap counts={heatmap} />
      </section>
    </div>
  );
}
