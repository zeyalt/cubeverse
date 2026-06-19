"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function OnboardingNamePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function handleNext() {
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }
    if (name.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }
    // Store in sessionStorage and navigate
    sessionStorage.setItem("onboarding_name", name);
    router.push("/onboarding/wca-id");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-between px-5 py-8">
      {/* Progress Bar */}
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/onboarding"
            className="text-white/50 hover:text-white transition-colors"
          >
            ← Back
          </Link>
          <span className="text-sm font-semibold text-white/70">Step 1 of 3</span>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-[#FFD500] transition-all duration-300"
            style={{ width: "33%" }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-md space-y-6 text-center kid-animate-in">
        <div>
          <h2 className="font-display text-3xl font-bold mb-2">What's your name?</h2>
          <p className="text-sm text-white/60">This is how we'll greet you!</p>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            placeholder="Enter your name"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-medium text-white placeholder-white/40 transition-colors focus:border-[#FFD500] focus:outline-none focus:ring-0"
            autoFocus
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </div>

      {/* Navigation */}
      <div className="w-full max-w-md flex gap-3">
        <Link
          href="/onboarding"
          className="btn-neutral flex min-h-12 flex-1 items-center justify-center px-4 text-center [touch-action:manipulation]"
        >
          ← Back
        </Link>
        <button
          onClick={handleNext}
          className="btn-accent flex min-h-12 flex-1 items-center justify-center px-4 text-center [touch-action:manipulation] disabled:opacity-50"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
