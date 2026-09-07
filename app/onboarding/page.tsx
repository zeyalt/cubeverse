"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { switchCuberInPlace } from "@/lib/client/actions";

type Cuber = { id: string; name: string; display_name: string | null; avatar_color: string };

export default function OnboardingWelcome() {
  const router = useRouter();
  const [existingCubers, setExistingCubers] = useState<Cuber[]>([]);

  useEffect(() => {
    void requireUser().then(async ({ db, ownerId }) => {
      const [{ data: settings }, { data: cubers }] = await Promise.all([
        db.from("app_settings").select("default_cuber_id").eq("owner_id", ownerId).maybeSingle(),
        db.from("cubers").select("id, name, display_name, avatar_color").eq("owner_id", ownerId),
      ]);
      if (settings?.default_cuber_id) router.replace("/");
      else setExistingCubers((cubers ?? []) as Cuber[]);
    });
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-8">
      <div className="kid-animate-in w-full max-w-md space-y-8 text-center">
        {/* Logo / Title */}
        <div>
          <div
            className="mx-auto mb-6 flex size-20 items-center justify-center rounded-2xl text-4xl font-display font-extrabold ring-2 ring-[#FFD500]/20"
            style={{ backgroundColor: "#FFD500", color: "#1A1208" }}
          >
            C
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Cubeverse</h1>
          <p className="mt-3 text-lg text-white/55">Let&apos;s start cubing!</p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link
            href="/onboarding/name"
            className="btn-accent flex min-h-12 w-full items-center justify-center px-6 text-center [touch-action:manipulation]"
          >
            Create New Cuber
          </Link>

          {existingCubers.length > 0 && (
            <details className="surface space-y-2 px-5 py-3 text-left">
              <summary className="cursor-pointer font-semibold text-white/80 hover:text-white">
                Select Existing Cuber ({existingCubers.length})
              </summary>
              <div className="mt-3 space-y-2">
                {existingCubers.map((cuber) => (
                    <button
                      key={cuber.id}
                      type="button"
                      onClick={() => void switchCuberInPlace(cuber.id).then(() => router.replace("/"))}
                      className="block w-full rounded-lg bg-white/5 px-4 py-2.5 text-left font-medium transition-colors hover:bg-white/10 [touch-action:manipulation]"
                    >
                      {cuber.display_name ?? cuber.name}
                    </button>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
