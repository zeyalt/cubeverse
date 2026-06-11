export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { KidHeader } from "@/components/kid/KidHeader";
import { switchCuber } from "@/app/actions/onboarding";

const AVATAR_HEX: Record<string, string> = {
  gold: "#FFD500",
  blue: "#0046AD",
  green: "#009B48",
  purple: "#B71234",
  orange: "#FF9800",
  pink: "#E91E63",
  red: "#F44336",
  cyan: "#00BCD4",
};

interface Cuber {
  id: string;
  name: string;
  display_name: string | null;
  avatar_color: string | null;
}

export default async function UserSelectPage() {
  const db = getServiceClient();
  const ownerId = getOwnerId();

  // Check if app_settings exists (user must be onboarded)
  const { data: settings } = await db
    .from("app_settings")
    .select("default_cuber_id, current_cuber_id")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!settings?.default_cuber_id) {
    redirect("/onboarding");
  }

  // Fetch all cubers for this owner
  const { data: cubers } = await db
    .from("cubers")
    .select("id, name, display_name, avatar_color")
    .eq("owner_id", ownerId)
    .order("name");

  const cuberList = cubers ?? [];

  if (cuberList.length === 0) {
    redirect("/onboarding");
  }

  const currentCuberId = settings.current_cuber_id ?? settings.default_cuber_id;

  return (
    <div className="kid-canvas min-h-screen flex flex-col text-white">
      <header className="relative z-10 px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
            Pick your cuber
          </p>
          <h1 className="font-display mt-2 text-3xl font-extrabold leading-tight">
            Who's cubing?
          </h1>
        </div>
      </header>

      <main className="flex-1 px-5 py-6 flex flex-col items-center justify-center">
        <div className="w-full max-w-md space-y-4">
          {cuberList.map((cuber) => {
            const avatarColor =
              AVATAR_HEX[cuber.avatar_color ?? "blue"] ?? "#0046AD";
            const displayName = cuber.display_name ?? cuber.name;
            const isActive = cuber.id === currentCuberId;

            return (
              <form
                key={cuber.id}
                action={async () => {
                  "use server";
                  await switchCuber(cuber.id);
                }}
              >
                <button
                  type="submit"
                  className={`sticker w-full flex items-center gap-4 rounded-2xl border-2 px-6 py-5 text-left font-bold transition-all active:scale-95 ${
                    isActive ? "scale-105" : "hover:bg-white/10"
                  }`}
                  style={{
                    backgroundColor: isActive ? avatarColor : "rgba(255,255,255,0.06)",
                    color: isActive
                      ? avatarColor === "#1A1200"
                        ? "#1A1200"
                        : "#FFFFFF"
                      : "rgba(255,255,255,0.85)",
                    borderColor: isActive ? "#0A0A0A" : "rgba(255,255,255,0.15)",
                    boxShadow: isActive
                      ? "4px 4px 0 #0A0A0A, inset 0 0 20px rgba(0,0,0,0.1)"
                      : "none",
                  }}
                >
                  <div
                    className="size-14 shrink-0 rounded-full border-2"
                    style={{
                      backgroundColor: avatarColor,
                      borderColor: isActive ? "#0A0A0A" : "rgba(255,255,255,0.3)",
                    }}
                  />
                  <div>
                    <p className="text-lg font-bold">{displayName}</p>
                    {isActive && (
                      <p className="text-sm opacity-75">Currently selected</p>
                    )}
                  </div>
                </button>
              </form>
            );
          })}
        </div>
      </main>
    </div>
  );
}
