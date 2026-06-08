"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { signUp } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating account…" : "Create account"}
    </Button>
  );
}

export default function SignupPage() {
  const [state, action] = useActionState(signUp, { error: null });

  return (
    <>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-6">
        Create account
      </h2>

      <form action={action} className="space-y-4">
        {state.error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            autoFocus
            required
            placeholder="letters, numbers, _ or -"
          />
          <p className="text-xs text-zinc-400">3–20 characters</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            placeholder="at least 8 characters"
          />
        </div>

        <SubmitButton />
      </form>

      <p className="mt-5 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-zinc-900 dark:text-zinc-50 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
