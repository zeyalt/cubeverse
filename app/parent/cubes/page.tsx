import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { CubesView } from "@/components/cubes/CubesView";
import { PageHeader } from "@/components/parent/PageHeader";

export default async function CubesPage() {
  const db = getServiceClient();
  const ownerId = getOwnerId();

  const { data: settings } = await db
    .from("app_settings")
    .select("default_cuber_id")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!settings) {
    return <p className="text-zinc-400 text-sm">Run setup first.</p>;
  }

  const cuberId = settings.default_cuber_id as string;

  const [{ data: cubes }, { data: events }] = await Promise.all([
    db
      .from("cubes")
      .select("id, name, brand, event_id, is_main, photo_url, acquired_on, notes")
      .eq("cuber_id", cuberId)
      .order("is_main", { ascending: false })
      .order("created_at"),
    db
      .from("events")
      .select("id, name")
      .order("sort_order"),
  ]);

  const eventNames = Object.fromEntries(
    (events ?? []).map((e) => [e.id as string, e.name as string])
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Cube collection" description="The gear shelf — mains, backups, and new additions." />
      <CubesView
        cubes={(cubes ?? []).map((c) => ({
          id: c.id as string,
          name: c.name as string,
          brand: c.brand as string | null,
          eventId: c.event_id as string | null,
          eventName: c.event_id ? eventNames[c.event_id as string] ?? null : null,
          isMain: c.is_main as boolean,
          photoUrl: c.photo_url as string | null,
          acquiredOn: c.acquired_on as string | null,
          notes: c.notes as string | null,
        }))}
        events={(events ?? []).map((e) => ({
          id: e.id as string,
          name: e.name as string,
        }))}
      />
    </div>
  );
}
