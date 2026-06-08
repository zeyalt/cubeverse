import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { KidModeHome } from "@/components/kid/KidModeHome";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: settings } = await supabase
    .from("app_settings")
    .select("default_cuber_id")
    .maybeSingle();

  if (!settings) redirect("/setup");

  const [{ data: cuber }, { data: events }] = await Promise.all([
    supabase
      .from("cubers")
      .select("name, display_name")
      .eq("id", settings.default_cuber_id)
      .single(),
    supabase
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
