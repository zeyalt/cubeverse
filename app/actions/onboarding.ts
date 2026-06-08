"use server";

import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { redirect } from "next/navigation";

export type FormState = { error: string | null };

export async function completeSetup(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const cuberName = (formData.get("cuber_name") as string)?.trim();
  if (!cuberName) return { error: "Child's name is required." };

  const db = getServiceClient();
  const ownerId = getOwnerId();

  const { data: cuber, error: cuberErr } = await db
    .from("cubers")
    .insert({ owner_id: ownerId, name: cuberName })
    .select("id")
    .single();

  if (cuberErr) return { error: cuberErr.message };

  const { error: settingsErr } = await db.from("app_settings").insert({
    owner_id: ownerId,
    default_cuber_id: cuber.id,
  });

  if (settingsErr) return { error: settingsErr.message };

  redirect("/");
}
