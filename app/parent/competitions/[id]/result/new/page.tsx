import { notFound } from "next/navigation";
import { getServiceClient } from "@/lib/supabase/service";
import { ResultForm } from "@/components/parent/ResultForm";

export default async function AddResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getServiceClient();

  const [{ data: comp }, { data: events }] = await Promise.all([
    db.from("competitions").select("id, name").eq("id", id).maybeSingle(),
    db.from("events").select("id, name, format").lte("sort_order", 15).order("sort_order"),
  ]);

  if (!comp) notFound();

  return (
    <ResultForm
      competitionId={comp.id}
      competitionName={comp.name}
      events={events ?? []}
    />
  );
}
