export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getServiceClient } from "@/lib/supabase/service";
import { KidCompetitionDetail } from "@/components/kid/KidCompetitionDetail";
import { getCompetitionNotes } from "@/app/actions/notes";

export default async function KidCompetitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getServiceClient();

  const [{ data: comp }, { data: results }, { data: events }] = await Promise.all([
    db
      .from("competitions")
      .select("id, name, type, city, country, start_date, end_date, cuber_id")
      .eq("id", id)
      .maybeSingle(),
    db
      .from("results")
      .select("id, event_id, round_type, format, best_cs, average_cs, solves(id, time_cs, penalty, position)")
      .eq("competition_id", id)
      .order("created_at"),
    db
      .from("events")
      .select("id, name, format")
      .gte("sort_order", 1)
      .lte("sort_order", 7)
      .order("sort_order"),
  ]);

  if (!comp) notFound();

  const cuberId = comp.cuber_id as string;
  const notes = await getCompetitionNotes(cuberId, id);

  return (
    <KidCompetitionDetail
      competition={comp}
      results={(results ?? []).map((r) => ({
        ...r,
        solves: r.solves
          ? [...r.solves].sort(
              (a, b) => (a as { position: number }).position - (b as { position: number }).position
            )
          : [],
      }))}
      events={events ?? []}
      cuberId={cuberId}
      notes={notes}
    />
  );
}
