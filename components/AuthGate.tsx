"use client";

import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const db = createClient();
    void db.auth.getSession().then(({ data }: { data: { session: Session | null } }) => setSession(data.session));
    const { data } = db.auth.onAuthStateChange((_event: AuthChangeEvent, next: Session | null) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  async function authenticate(mode: "sign-in" | "sign-up") {
    setPending(true);
    setError(null);
    const db = createClient();
    const result =
      mode === "sign-in"
        ? await db.auth.signInWithPassword({ email, password })
        : await db.auth.signUp({ email, password });
    setPending(false);
    if (result.error) setError(result.error.message);
    else setSession(result.data.session);
  }

  if (session === undefined) {
    return <div className="kid-canvas min-h-dvh" aria-label="Loading Cubeverse" />;
  }

  if (!session) {
    return (
      <main className="kid-canvas flex min-h-dvh items-center justify-center p-5 text-white">
        <form
          className="surface w-full max-w-sm space-y-4 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void authenticate("sign-in");
          }}
        >
          <div>
            <h1 className="font-display text-3xl font-extrabold">Cubeverse</h1>
            <p className="mt-1 text-sm text-white/55">Sign in with the household account.</p>
          </div>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Family email"
            className="h-12 w-full rounded-lg border border-white/15 bg-white/5 px-3"
          />
          <input
            type="password"
            autoComplete="current-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="h-12 w-full rounded-lg border border-white/15 bg-white/5 px-3"
          />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button type="submit" disabled={pending} className="btn-accent min-h-12 w-full px-4 disabled:opacity-50">
            {pending ? "Signing in…" : "Sign in"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void authenticate("sign-up")}
            className="btn-neutral min-h-11 w-full px-4 text-sm disabled:opacity-50"
          >
            Create household account
          </button>
        </form>
      </main>
    );
  }

  return children;
}
