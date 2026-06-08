export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { KidModeHome } from "@/components/kid/KidModeHome";

export default async function Home() {
  const db = getServiceClient();
  const ownerId = getOwnerId();

  const { data: settings } = await db
    .from("app_settings")
    .select("default_cuber_id")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!settings) redirect("/setup");

  const [{ data: cuber }, { data: events }] = await Promise.all([
    db
      .from("cubers")
      .select("name, display_name")
      .eq("id", settings.default_cuber_id)
      .single(),
    db
      .from("events")
      .select("id, name, format")
      .gte("sort_order", 1)
      .lte("sort_order", 7)
      .order("sort_order"),
  ]);

  const jar = await cookies();
  const savedEvent = jar.get("cubeverse_event")?.value ?? "333";
  const validEventId =
    events?.some((e) => e.id === savedEvent) ? savedEvent : "333";

  return (
    <KidModeHome
      cuberName={cuber?.display_name ?? cuber?.name ?? "Cuber"}
      events={events ?? []}
      defaultEventId={validEventId}
    />
  );
}
