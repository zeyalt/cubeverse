"use server";

import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { redirect } from "next/navigation";

export type FormState = { error: string | null; redirectTo?: string };

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

export async function completeOnboarding({
  name,
  wcaId,
  avatarColor,
}: {
  name: string;
  wcaId: string | null;
  avatarColor: string;
}): Promise<FormState> {
  if (!name?.trim()) return { error: "Name is required." };
  if (!avatarColor) return { error: "Avatar color is required." };

  const db = getServiceClient();
  const ownerId = getOwnerId();

  // Insert cuber with avatar color
  const { data: cuber, error: cuberErr } = await db
    .from("cubers")
    .insert({
      owner_id: ownerId,
      name: name.trim(),
      display_name: name.trim(),
      wca_id: wcaId || null,
      avatar_color: avatarColor,
    })
    .select("id")
    .single();

  if (cuberErr || !cuber) return { error: cuberErr?.message || "Failed to create cuber" };

  // Check if this is the first cuber for this owner
  const { data: existingCubers, error: countErr } = await db
    .from("cubers")
    .select("id")
    .eq("owner_id", ownerId);

  if (countErr) {
    console.error("[completeOnboarding] Error counting cubers:", countErr.message);
    return { error: "Failed to check existing cubers" };
  }

  const cuberCount = (existingCubers?.length ?? 0);
  const isFirstCuber = cuberCount === 1; // Just created the first one
  const exceedsMaxCubers = cuberCount > 4;

  if (exceedsMaxCubers) {
    // Delete the cuber we just created
    await db.from("cubers").delete().eq("id", cuber.id);
    return { error: "Maximum 4 cubers per account. Please remove one to add another." };
  }

  // Upsert app settings (insert or update if already exists)
  const { error: settingsErr } = await db.from("app_settings").upsert({
    owner_id: ownerId,
    default_cuber_id: isFirstCuber ? cuber.id : undefined,
    current_cuber_id: cuber.id,
  });

  if (settingsErr) {
    console.error("[completeOnboarding] Settings upsert error:", settingsErr.message);
    return { error: settingsErr.message };
  }

  // Return success - client will handle redirect
  return { error: null, redirectTo: isFirstCuber ? "/" : "/user-select" };
}

export async function switchCuber(cuberId: string): Promise<void> {
  const db = getServiceClient();
  const ownerId = getOwnerId();
  await db
    .from("app_settings")
    .update({ current_cuber_id: cuberId })
    .eq("owner_id", ownerId);
  redirect("/");
}
