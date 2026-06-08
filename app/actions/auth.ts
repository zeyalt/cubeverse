"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type FormState = { error: string | null };

const USERNAME_RE = /^[a-z0-9_-]{3,20}$/;

function normalise(username: string) {
  return username.trim().toLowerCase();
}

export async function signUp(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const raw = formData.get("username") as string;
  const password = formData.get("password") as string;

  const username = normalise(raw ?? "");
  if (!USERNAME_RE.test(username)) {
    return {
      error:
        "Username must be 3–20 characters: letters, numbers, _ or - only.",
    };
  }
  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: `${username}@cubeverse.local`,
    password,
  });

  if (error) return { error: error.message };
  redirect("/setup");
}

export async function signIn(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const raw = formData.get("username") as string;
  const password = formData.get("password") as string;

  const username = normalise(raw ?? "");
  if (!username) return { error: "Username is required." };
  if (!password) return { error: "Password is required." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: `${username}@cubeverse.local`,
    password,
  });

  if (error) return { error: "Invalid username or password." };

  // Route to setup if this is the first login.
  const { data: settings } = await supabase
    .from("app_settings")
    .select("owner_id")
    .maybeSingle();

  if (!settings) redirect("/setup");
  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
