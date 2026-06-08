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
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Setting up…" : "Let's go!"}
    </Button>
  );
}

export default function SetupPage() {
  const [state, action] = useActionState(completeSetup, { error: null });

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Cubeverse
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Let&apos;s set things up
          </p>
        </div>

        <form action={action} className="space-y-4">
          {state.error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="cuber_name">Child&apos;s name</Label>
            <Input
              id="cuber_name"
              name="cuber_name"
              autoFocus
              required
              placeholder="e.g. Zayyan"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pin">Parent PIN</Label>
            <Input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              maxLength={4}
              required
              placeholder="4-digit PIN"
            />
            <p className="text-xs text-zinc-400">
              Used to access parent analytics. Must be 4 digits.
            </p>
          </div>

          <SubmitButton />
        </form>
      </div>
    </div>
  );
}
