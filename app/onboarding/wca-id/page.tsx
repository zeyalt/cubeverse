"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect } from "react";
import Link from "next/link";

export default function OnboardingWcaIdPage() {
  const router = useRouter();
  const [name, setName] = useState("");

  const [wcaId, setWcaId] = useState("");
  const [error, setError] = useState("");
  const [wcaData, setWcaData] = useState<any>(null);
  const [isPending, startTransition] = useTransition();

  const wcaIdRegex = /^\d{4}[A-Z]{4}\d{2}$/i;

  useEffect(() => {
    // Get name from sessionStorage
    const storedName = sessionStorage.getItem("onboarding_name");
    if (!storedName) {
      router.push("/onboarding/name");
    } else {
      setName(storedName);
    }
  }, [router]);

  function handleFetchWCA() {
    if (!wcaId.trim()) {
      setError("Please enter a WCA ID");
      return;
    }
    if (!wcaIdRegex.test(wcaId)) {
      setError("Invalid WCA ID format (e.g., 2025ZEYA01)");
      return;
    }

    setError("");
    startTransition(async () => {
      try {
        const res = await fetch(`https://www.worldcubeassociation.org/api/v0/persons/${wcaId}`);
        if (!res.ok) {
          console.error(`WCA API error: ${res.status}`);
          throw new Error("WCA ID not found");
        }

        const data = await res.json();
        console.log("WCA data:", data);

        if (!data) {
          throw new Error("No data received from WCA API");
        }

        // WCA API returns person object with optional name/country
        // Accept it even if name is missing
        setWcaData(data);
      } catch (err) {
        console.error("WCA fetch error:", err);
        setError("Could not fetch WCA data. You can skip this step.");
        setWcaData(null);
      }
    });
  }

  function handleNext() {
    sessionStorage.setItem("onboarding_wca_id", wcaId || "skip");
    router.push("/onboarding/avatar");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-between px-5 py-8">
      {/* Progress Bar */}
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/onboarding/name"
            className="text-white/50 hover:text-white transition-colors"
          >
            ← Back
          </Link>
          <span className="text-sm font-semibold text-white/70">Step 2 of 3</span>
        </div>

        <div className="mb-8 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-[#FFD500] transition-all duration-300"
            style={{ width: "66%" }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-md space-y-6 text-center kid-animate-in">
        <div>
          <h2 className="font-display text-3xl font-bold mb-2">Your WCA ID</h2>
          <p className="text-sm text-white/60">Optional — we'll import your competition data</p>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={wcaId}
              onChange={(e) => {
                setWcaId(e.target.value.toUpperCase());
                setError("");
              }}
              placeholder="e.g., 2025ZEYA01"
              className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-mono text-white placeholder-white/40 transition-colors focus:border-[#FFD500] focus:outline-none"
              disabled={isPending}
            />
            <button
              onClick={handleFetchWCA}
              disabled={isPending || !wcaId.trim()}
              className="btn-neutral flex min-h-12 items-center justify-center px-4 [touch-action:manipulation] disabled:opacity-50"
            >
              {isPending ? "..." : "Fetch"}
            </button>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {wcaData && (
            <div className="rounded-lg bg-green-500/20 px-3 py-2 text-sm text-green-300">
              WCA ID verified {wcaData.name ? `— ${wcaData.name}` : ""} {wcaData.country?.name ? `(${wcaData.country.name})` : ""}
            </div>
          )}
        </div>

        {wcaId && (
          <button
            onClick={() => setWcaId("")}
            className="text-sm text-white/50 hover:text-white transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Navigation */}
      <div className="w-full max-w-md flex gap-3">
        <Link
          href="/onboarding/name"
          className="btn-neutral flex min-h-12 flex-1 items-center justify-center px-4 text-center [touch-action:manipulation]"
        >
          ← Back
        </Link>
        <button
          onClick={handleNext}
          disabled={isPending}
          className="btn-accent flex min-h-12 flex-1 items-center justify-center px-4 text-center [touch-action:manipulation] disabled:opacity-50"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
