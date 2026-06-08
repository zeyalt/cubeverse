import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: settings } = await supabase
    .from("app_settings")
    .select("owner_id, default_cuber_id")
    .maybeSingle();

  if (!settings) redirect("/setup");

  const { data: cuber } = await supabase
    .from("cubers")
    .select("name")
    .eq("id", settings.default_cuber_id)
    .single();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-black gap-4">
      <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        Cubeverse
      </h1>
      <p className="text-zinc-500 dark:text-zinc-400">
        Welcome, {cuber?.name ?? "cuber"}! Kid mode coming in Phase 4.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="text-sm text-zinc-400 hover:text-zinc-600 underline"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
