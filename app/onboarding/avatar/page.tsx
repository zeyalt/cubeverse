"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { completeOnboarding } from "@/app/actions/onboarding";

const AVATAR_COLORS = [
  { key: "gold", color: "#FFD500", label: "Gold" },
  { key: "blue", color: "#0046AD", label: "Blue" },
  { key: "green", color: "#009B48", label: "Green" },
  { key: "purple", color: "#B71234", label: "Purple" },
  { key: "orange", color: "#FF9800", label: "Orange" },
  { key: "pink", color: "#E91E63", label: "Pink" },
  { key: "red", color: "#F44336", label: "Red" },
  { key: "cyan", color: "#00BCD4", label: "Cyan" },
];

export default function OnboardingAvatarPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [wcaId, setWcaId] = useState("");
  const [selectedColor, setSelectedColor] = useState("blue");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // Get name and WCA ID from sessionStorage
    const storedName = sessionStorage.getItem("onboarding_name");
    const storedWcaId = sessionStorage.getItem("onboarding_wca_id");

    if (!storedName) {
      router.push("/onboarding/name");
    } else {
      setName(storedName);
      setWcaId(storedWcaId || "");
    }
  }, [router]);

  function handleSubmit() {
    startTransition(async () => {
      try {
        const result = await completeOnboarding({
          name,
          wcaId: wcaId === "skip" || !wcaId ? null : wcaId,
          avatarColor: selectedColor,
        });

        if (result.error) {
          setError(result.error);
          return;
        }

        // Clear sessionStorage and redirect
        sessionStorage.removeItem("onboarding_name");
        sessionStorage.removeItem("onboarding_wca_id");

        if (result.redirectTo) {
          router.push(result.redirectTo);
        }
      } catch (err) {
        setError("Failed to complete onboarding");
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-between px-5 py-8">
      {/* Progress Bar */}
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/onboarding/wca-id"
            className="text-white/50 hover:text-white transition-colors"
          >
            ← Back
          </Link>
          <span className="text-sm font-semibold text-white/70">Step 3 of 3</span>
        </div>

        <div className="mb-8 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-[#FFD500] transition-all duration-300"
            style={{ width: "100%" }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-md space-y-6 text-center kid-animate-in">
        <div>
          <h2 className="font-display text-3xl font-bold mb-2">Pick your avatar</h2>
          <p className="text-sm text-white/60">This is your color!</p>
        </div>

        {/* Avatar Grid */}
        <div className="grid grid-cols-4 gap-4">
          {AVATAR_COLORS.map(({ key, color, label }) => (
            <button
              key={key}
              onClick={() => setSelectedColor(key)}
              className={`flex items-center justify-center rounded-2xl transition-all [touch-action:manipulation] ${
                selectedColor === key ? "scale-105" : "scale-100 hover:scale-105"
              }`}
              style={{
                backgroundColor: color,
                width: "80px",
                height: "80px",
                boxShadow:
                  selectedColor === key
                    ? "0 0 0 3px #FFD500, 0 4px 12px rgba(0,0,0,0.4)"
                    : "0 2px 6px rgba(0,0,0,0.3)",
              }}
              title={label}
              aria-label={label}
              aria-pressed={selectedColor === key}
            >
              {selectedColor === key && (
                <Check className="size-7 text-white" strokeWidth={3} />
              )}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      {/* Navigation */}
      <div className="w-full max-w-md flex gap-3">
        <Link
          href="/onboarding/wca-id"
          className="btn-neutral flex min-h-12 flex-1 items-center justify-center px-4 text-center [touch-action:manipulation]"
        >
          ← Back
        </Link>
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="btn-accent flex min-h-12 flex-1 items-center justify-center px-4 text-center [touch-action:manipulation] disabled:opacity-50"
        >
          {isPending ? "Starting..." : "Start Cubing!"}
        </button>
      </div>
    </div>
  );
}
