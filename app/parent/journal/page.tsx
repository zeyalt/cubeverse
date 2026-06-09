import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { mediaPublicUrl } from "@/lib/media";
import { JournalView } from "@/components/journal/JournalView";
import { PageHeader } from "@/components/parent/PageHeader";

export default async function JournalPage() {
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

  const [{ data: entries }, { data: competitions }, { data: media }] =
    await Promise.all([
      db
        .from("journal_entries")
        .select("id, title, body, mood, author, entry_date, competition_id")
        .eq("cuber_id", cuberId)
        .order("entry_date", { ascending: false }),
      db
        .from("competitions")
        .select("id, name")
        .eq("cuber_id", cuberId)
        .order("start_date", { ascending: false }),
      db
        .from("media")
        .select("linked_id, storage_path")
        .eq("cuber_id", cuberId)
        .eq("linked_type", "journal"),
    ]);

  const compNames = Object.fromEntries(
    (competitions ?? []).map((c) => [c.id as string, c.name as string])
  );

  const photoByEntry = new Map(
    (media ?? []).map((m) => [
      m.linked_id as string,
      mediaPublicUrl(db, m.storage_path as string),
    ])
  );

  const enriched = (entries ?? []).map((e) => ({
    id: e.id as string,
    title: e.title as string | null,
    body: e.body as string | null,
    mood: e.mood as string | null,
    author: e.author as string,
    entryDate: e.entry_date as string,
    competitionName: e.competition_id
      ? compNames[e.competition_id as string] ?? null
      : null,
    photoUrl: photoByEntry.get(e.id as string) ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal"
        description="Reflections and memories from competitions and practice days."
      />
      <JournalView
        entries={enriched}
        competitions={(competitions ?? []).map((c) => ({
          id: c.id as string,
          name: c.name as string,
        }))}
      />
    </div>
  );
}
