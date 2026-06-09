import { notFound } from "next/navigation";
import Link from "next/link";
import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import {
  getPbStaircase,
  getSolvesOverTime,
  getSolveDistribution,
  getConsistency,
} from "@/lib/analytics";
import { PbStaircase } from "@/components/analytics/PbStaircase";
import { SolvesOverTime } from "@/components/analytics/SolvesOverTime";
import { SolveDistribution } from "@/components/analytics/SolveDistribution";
import { Consistency } from "@/components/analytics/Consistency";
import { ArrowLeft, ListOrdered } from "lucide-react";

const ACTIVE_EVENTS: Record<string, string> = {
  "333": "3×3×3 Cube",
  "222": "2×2×2 Cube",
  pyram: "Pyraminx",
  skewb: "Skewb",
  clock: "Clock",
  "444": "4×4×4 Cube",
  "333oh": "3×3×3 One-Handed",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
        <h3 className="font-semibold text-sm text-zinc-700 dark:text-zinc-300">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default async function EventAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!ACTIVE_EVENTS[id]) notFound();

  const db = getServiceClient();
  const ownerId = getOwnerId();

  const { data: settings } = await db
    .from("app_settings")
    .select("default_cuber_id")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!settings) notFound();
  const cuberId = settings.default_cuber_id as string;

  const [staircase, timeline, distribution, consistency] = await Promise.all([
    getPbStaircase(db, cuberId, id),
    getSolvesOverTime(db, cuberId, id),
    getSolveDistribution(db, cuberId, id),
    getConsistency(db, cuberId, id),
  ]);

  const solveCount = timeline.points.length;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/parent/overview"
          className="p-1.5 -m-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {ACTIVE_EVENTS[id]}
          </h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {solveCount} practice solve{solveCount !== 1 ? "s" : ""}
          </p>
        </div>

        {/* History + Event switcher */}
        <div className="ml-auto flex items-center gap-3 flex-wrap">
          <Link
            href={`/parent/event/${id}/history`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            title="View all practice solves"
          >
            <ListOrdered className="w-4 h-4" />
            <span className="text-xs font-medium">History</span>
          </Link>
          <div className="flex flex-wrap gap-1.5">
          {Object.entries(ACTIVE_EVENTS).map(([eid, name]) => (
            <Link
              key={eid}
              href={`/parent/event/${eid}`}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                eid === id
                  ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {name.split(" ")[0]}
            </Link>
          ))}
          </div>
        </div>
      </div>

      {/* PB Staircase */}
      <Section title="PB Staircase — Official vs Practice">
        <PbStaircase data={staircase} />
      </Section>

      {/* Solves over time */}
      <Section title="Solves Over Time">
        <SolvesOverTime data={timeline} />
      </Section>

      {/* Distribution + Consistency side by side on wider screens */}
      <div className="grid md:grid-cols-2 gap-6">
        <Section title="Solve Distribution">
          <SolveDistribution bins={distribution} />
        </Section>

        <Section title="Consistency (rolling σ)">
          <Consistency points={consistency} window={20} />
        </Section>
      </div>
    </div>
  );
}
