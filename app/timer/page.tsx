export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/supabase/service";
import { TimerView } from "@/components/timer/TimerView";

const FALLBACK = { id: "333", name: "3×3×3 Cube" };

export default async function TimerPage() {
  const jar = await cookies();
  const eventId = jar.get("cubeverse_event")?.value ?? "333";

  const db = getServiceClient();
  const { data } = await db
    .from("events")
    .select("id, name")
    .eq("id", eventId)
    .maybeSingle();

  return <TimerView event={data ?? FALLBACK} />;
}
