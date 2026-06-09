"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { completeSetup } from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="sticker h-12 w-full rounded-xl border-2 border-[#0A0A0A] bg-[#0046AD] text-base font-bold text-white hover:bg-[#003A8F]"
      disabled={pending}
    >
      {pending ? "Setting up…" : "Start cubing!"}
    </Button>
  );
}

export default function SetupPage() {
  const [state, action] = useActionState(completeSetup, { error: null });

  return (
    <div className="kid-canvas flex min-h-screen items-center justify-center p-5">
      <div className="w-full max-w-md kid-animate-in">
        <div className="mb-8 text-center">
          <div
            className="sticker mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl text-3xl font-display font-extrabold"
            style={{ backgroundColor: "#FFD500", color: "#1A1208" }}
          >
            C
          </div>
          <h1 className="font-display text-4xl font-extrabold text-white">Cubeverse</h1>
          <p className="mt-2 text-sm text-white/50">Who are we tracking?</p>
        </div>

        <div className="sticker rounded-2xl bg-[#FFFCF7] p-7 text-[#1A1208]">
          <form action={action} className="space-y-5">
            {state.error && (
              <p className="rounded-lg border-2 border-[#B71234] bg-[#FEF2F2] px-3 py-2 text-sm text-[#B71234]">
                {state.error}
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="cuber_name" className="font-semibold">
                Cuber&apos;s name
              </Label>
              <Input
                id="cuber_name"
                name="cuber_name"
                autoFocus
                required
                placeholder="e.g. Zayyan"
                className="h-12 rounded-lg border-2 border-[#1A1208] text-base"
              />
            </div>

            <SubmitButton />
          </form>
        </div>
      </div>
    </div>
  );
}
