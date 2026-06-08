"use server";

import { createClient } from "@/lib/supabase/server";
import { hashPin } from "@/lib/pin";
import { redirect } from "next/navigation";
import type { FormState } from "./auth";

export async function completeSetup(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const cuberName = (formData.get("cuber_name") as string)?.trim();
  const pin = (formData.get("pin") as string)?.trim();

  if (!cuberName) return { error: "Child's name is required." };
  if (!/^\d{4}$/.test(pin)) return { error: "PIN must be exactly 4 digits." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const pinHash = await hashPin(pin);

  const { data: cuber, error: cuberErr } = await supabase
    .from("cubers")
    .insert({ owner_id: user.id, name: cuberName })
    .select("id")
    .single();

  if (cuberErr) return { error: cuberErr.message };

  const { error: settingsErr } = await supabase.from("app_settings").insert({
    owner_id: user.id,
    parent_pin_hash: pinHash,
    default_cuber_id: cuber.id,
  });

  if (settingsErr) return { error: settingsErr.message };

  redirect("/");
}
