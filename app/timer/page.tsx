export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { TimerView } from "@/components/timer/TimerView";
import { redirect } from "next/navigation";

const FALLBACK_EVENT = { id: "333", name: "3×3×3 Cube" };

export default async function TimerPage() {
  const db = getServiceClient();
  const ownerId = getOwnerId();

  const { data: settings } = await db
    .from("app_settings")
    .select("default_cuber_id")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!settings) redirect("/setup");

  const jar = await cookies();
  const eventId = jar.get("cubeverse_event")?.value ?? "333";

  const [{ data: event }, { data: cuber }] = await Promise.all([
    db.from("events").select("id, name").eq("id", eventId).maybeSingle(),
    db.from("cubers").select("name, display_name").eq("id", settings.default_cuber_id).single(),
  ]);

  return (
    <TimerView
      event={event ?? FALLBACK_EVENT}
      cuberId={settings.default_cuber_id as string}
      cuberName={cuber?.display_name ?? cuber?.name ?? "Cuber"}
    />
  );
}
