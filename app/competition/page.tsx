"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { KidCompetitionDetail } from "@/components/kid/KidCompetitionDetail";
import { getCompetitionNotes } from "@/lib/client/actions";
import { requireUser } from "@/lib/supabase/auth";
import { ACTIVE_EVENTS } from "@/lib/event-theme";

type Detail = React.ComponentProps<typeof KidCompetitionDetail>;

function CompetitionLoader() {
  const params = useSearchParams();
  const id = params.get("id");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!id) return;
    void requireUser().then(async ({ db }) => {
      const [{ data: competition }, { data: results }, { data: events }] = await Promise.all([
        db.from("competitions").select("id, name, type, city, country, start_date, end_date, cuber_id").eq("id", id).maybeSingle(),
        db.from("results")
          .select("id, event_id, round_type, format, best_cs, average_cs, solves(id, time_cs, penalty, position)")
          .eq("competition_id", id).order("created_at"),
        db.from("events").select("id, name, format").in("id", ACTIVE_EVENTS).order("sort_order"),
      ]);
      if (!competition) {
        setMissing(true);
        return;
      }
      const notes = await getCompetitionNotes(competition.cuber_id, id);
      setDetail({
        competition,
        results: (results ?? []).map((result: { solves: Array<{ position: number }> | null; [key: string]: unknown }) => ({
          ...result,
          solves: result.solves ? [...result.solves].sort((a, b) => a.position - b.position) : [],
        })),
        events: events ?? [],
        cuberId: competition.cuber_id,
        notes,
      } as Detail);
    });
  }, [id]);

  if (!id || missing) return <main className="kid-canvas min-h-dvh p-6 text-white">Competition not found.</main>;
  if (!detail) return <div className="kid-canvas min-h-dvh" aria-label="Loading competition" />;
  return <KidCompetitionDetail {...detail} />;
}

export default function CompetitionPage() {
  return (
    <Suspense fallback={<div className="kid-canvas min-h-dvh" />}>
      <CompetitionLoader />
    </Suspense>
  );
}
