import Link from "next/link";
import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Trophy } from "lucide-react";

export default async function CompetitionsPage() {
  const db = getServiceClient();
  const ownerId = getOwnerId();

  const { data: settings } = await db
    .from("app_settings")
    .select("default_cuber_id")
    .eq("owner_id", ownerId)
    .maybeSingle();

  const { data: comps } = settings
    ? await db
        .from("competitions")
        .select("id, name, type, city, country, start_date, end_date")
        .eq("cuber_id", settings.default_cuber_id)
        .order("start_date", { ascending: false })
    : { data: [] };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Competitions
          </h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {comps?.length ?? 0} competition{comps?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/parent/competitions/new" className={cn(buttonVariants())}>
          <Plus className="w-4 h-4 mr-1" />
          Add unofficial comp
        </Link>
      </div>

      {!comps?.length && (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
          <Trophy className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">No competitions yet.</p>
          <p className="text-xs mt-1">
            Add an unofficial comp above, or import from WCA in Phase 8.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {comps?.map((comp) => (
          <Link
            key={comp.id}
            href={`/parent/competitions/${comp.id}`}
            className="block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900
                       p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {comp.name}
                </p>
                {(comp.city || comp.country) && (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {[comp.city, comp.country].filter(Boolean).join(", ")}
                  </p>
                )}
                {comp.start_date && (
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {comp.start_date}
                    {comp.end_date && comp.end_date !== comp.start_date
                      ? ` – ${comp.end_date}`
                      : ""}
                  </p>
                )}
              </div>
              <Badge variant={comp.type === "wca" ? "default" : "secondary"}>
                {comp.type === "wca" ? "WCA" : "Unofficial"}
              </Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
