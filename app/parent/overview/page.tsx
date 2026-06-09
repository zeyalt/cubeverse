import Link from "next/link";
import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { getCurrentPbs, getHeatmapCounts } from "@/lib/analytics";
import { formatCs } from "@/lib/cubing";
import { PracticeHeatmap } from "@/components/analytics/PracticeHeatmap";
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
    <span className="ml-1 text-xs text-green-600 dark:text-green-400 font-medium">
      ↑{formatCs(delta)} better
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

  if (!settings) return <p className="text-zinc-400 text-sm">Run setup first.</p>;
  const cuberId = settings.default_cuber_id as string;

  const [pbs, heatmap] = await Promise.all([
    getCurrentPbs(db, cuberId, ACTIVE_EVENTS),
    getHeatmapCounts(db, cuberId),
  ]);

  const totalSolves = Object.values(heatmap).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Overview</h2>
        <p className="text-sm text-zinc-500 mt-0.5">Current PBs and practice activity</p>
      </div>

      {/* PB table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
          <h3 className="font-semibold text-sm text-zinc-700 dark:text-zinc-300">Personal Bests</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-400 uppercase tracking-wide">Event</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-zinc-400 uppercase tracking-wide">Official Single</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-zinc-400 uppercase tracking-wide">Official Avg</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-zinc-400 uppercase tracking-wide">Practice Single</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-zinc-400 uppercase tracking-wide">Practice Avg</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {pbs.map((row, i) => (
                <tr
                  key={row.eventId}
                  className={`${i < pbs.length - 1 ? "border-b border-zinc-100 dark:border-zinc-800" : ""}`}
                >
                  <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-50">
                    {EVENT_NAMES[row.eventId] ?? row.eventId}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-zinc-700 dark:text-zinc-300">
                    {fmt(row.officialSingle)}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-zinc-700 dark:text-zinc-300">
                    {fmt(row.officialAvg)}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-zinc-700 dark:text-zinc-300">
                    {fmt(row.practiceSingle)}
                    <DeltaBadge official={row.officialSingle} practice={row.practiceSingle} />
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-zinc-700 dark:text-zinc-300">
                    {fmt(row.practiceAvg)}
                    <DeltaBadge official={row.officialAvg} practice={row.practiceAvg} />
                  </td>
                  <td className="px-2">
                    <Link
                      href={`/parent/event/${row.eventId}`}
                      className="text-zinc-300 hover:text-indigo-500 transition-colors"
                      title={`Analytics for ${EVENT_NAMES[row.eventId] ?? row.eventId}`}
                    >
                      <TrendingUp className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Practice heatmap */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Practice activity</h3>
          <span className="text-xs text-zinc-400">{totalSolves} solve{totalSolves !== 1 ? "s" : ""} in the last year</span>
        </div>
        <PracticeHeatmap counts={heatmap} />
      </div>
    </div>
  );
}
