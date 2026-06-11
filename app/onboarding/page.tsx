import { redirect } from "next/navigation";
import Link from "next/link";
import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";

export default async function OnboardingWelcome() {
  const db = getServiceClient();
  const ownerId = getOwnerId();

  // Check if app_settings exists
  const { data: settings } = await db
    .from("app_settings")
    .select("default_cuber_id, current_cuber_id")
    .eq("owner_id", ownerId)
    .maybeSingle();

  // If settings exist with a valid default_cuber_id, user has already completed onboarding
  if (settings?.default_cuber_id) {
    redirect("/");
  }

  // Fetch existing cubers for this owner
  const { data: cubers } = await db
    .from("cubers")
    .select("id, name, display_name, avatar_color")
    .eq("owner_id", ownerId);

  const existingCubers = cubers ?? [];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-8">
      <div className="kid-animate-in w-full max-w-md space-y-8 text-center">
        {/* Logo / Title */}
        <div>
          <div
            className="sticker mx-auto mb-6 flex size-24 items-center justify-center rounded-3xl text-5xl font-display font-extrabold"
            style={{ backgroundColor: "#FFD500", color: "#1A1208" }}
          >
            C
          </div>
          <h1 className="font-display text-4xl font-extrabold">Cubeverse</h1>
          <p className="mt-3 text-lg text-white/60">Let's start cubing!</p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link
            href="/onboarding/name"
            className="sticker block w-full rounded-xl border-2 border-[#0A0A0A] bg-[#FFD500] px-6 py-3 text-center font-bold text-[#1A1208] transition-transform hover:scale-105 active:scale-95"
          >
            Create New Cuber
          </Link>

          {existingCubers.length > 0 && (
            <details className="sticker space-y-2 rounded-xl border-2 border-[#0A0A0A] bg-white/10 px-6 py-3">
              <summary className="cursor-pointer font-bold text-white/80 hover:text-white">
                Select Existing Cuber ({existingCubers.length})
              </summary>
              <div className="mt-3 space-y-2">
                {existingCubers.map((cuber) => (
                  <form key={cuber.id} action="/api/select-cuber" method="POST">
                    <input type="hidden" name="cuber_id" value={cuber.id} />
                    <button
                      type="submit"
                      className="block w-full rounded-lg bg-white/10 px-4 py-2 text-left font-medium transition-colors hover:bg-white/20"
                    >
                      👤 {cuber.display_name ?? cuber.name}
                    </button>
                  </form>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
