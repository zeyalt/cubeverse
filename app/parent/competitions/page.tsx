import Link from "next/link";
import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/parent/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { Calendar, ChevronRight, MapPin, Plus, Trophy } from "lucide-react";

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
      <PageHeader
        title="Competitions"
        description={`${comps?.length ?? 0} competition${comps?.length !== 1 ? "s" : ""} on record`}
        action={
          <Link href="/parent/competitions/new" className={cn(buttonVariants())}>
            <Plus className="size-4" />
            Add unofficial
          </Link>
        }
      />

      {!comps?.length ? (
        <EmptyState
          icon={Trophy}
          title="No competitions yet"
          description="Import from WCA or add an unofficial competition manually."
          action={
            <Link href="/parent/import" className={cn(buttonVariants({ variant: "outline" }))}>
              Import WCA results
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {comps.map((comp) => (
            <Link
              key={comp.id}
              href={`/parent/competitions/${comp.id}`}
              className="parent-surface group flex items-center gap-4 p-4 transition-all hover:shadow-md hover:shadow-black/[0.04]"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <Trophy className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-foreground truncate">{comp.name}</p>
                  <Badge variant={comp.type === "wca" ? "default" : "secondary"}>
                    {comp.type === "wca" ? "WCA" : "Unofficial"}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {(comp.city || comp.country) && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" />
                      {[comp.city, comp.country].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {comp.start_date && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="size-3" />
                      {comp.start_date}
                      {comp.end_date && comp.end_date !== comp.start_date
                        ? ` – ${comp.end_date}`
                        : ""}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
