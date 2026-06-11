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

  // Insert cuber with avatar color (try with avatar_color, fallback if schema cache is stale)
  let cuber: { id: string } | null = null;
  let cuberErr: any = null;

  const cuberInsert = {
    owner_id: ownerId,
    name: name.trim(),
    display_name: name.trim(),
    wca_id: wcaId || null,
    avatar_color: avatarColor,
  };

  const result = await db
    .from("cubers")
    .insert(cuberInsert)
    .select("id")
    .single();

  cuber = result.data;
  cuberErr = result.error;

  // If schema cache is stale, try without avatar_color
  if (cuberErr && cuberErr.message?.includes("avatar_color")) {
    const fallbackInsert = {
      owner_id: ownerId,
      name: name.trim(),
      display_name: name.trim(),
      wca_id: wcaId || null,
    };

    const fallbackResult = await db
      .from("cubers")
      .insert(fallbackInsert)
      .select("id")
      .single();

    cuber = fallbackResult.data;
    cuberErr = fallbackResult.error;

    if (!cuberErr) {
      // Avatar color will need to be updated separately
      console.warn("Avatar color not saved due to schema cache - will update after refresh");
    }
  }

  if (cuberErr || !cuber) return { error: cuberErr?.message || "Failed to create cuber" };

  console.log("[completeOnboarding] Created cuber:", cuber.id);

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
  // Try with current_cuber_id first, fallback if schema cache is stale
  let settingsResult = await db.from("app_settings").upsert({
    owner_id: ownerId,
    default_cuber_id: isFirstCuber ? cuber.id : undefined,
    current_cuber_id: cuber.id,
  });

  let settingsErr = settingsResult.error;

  // If schema cache is stale, try without current_cuber_id
  if (settingsErr && settingsErr.message?.includes("current_cuber_id")) {
    console.warn("[completeOnboarding] current_cuber_id not available due to schema cache - will update after refresh");
    settingsResult = await db.from("app_settings").upsert({
      owner_id: ownerId,
      default_cuber_id: isFirstCuber ? cuber.id : undefined,
    });
    settingsErr = settingsResult.error;
  }

  if (settingsErr) {
    console.error("[completeOnboarding] Settings upsert error:", settingsErr.message);
    return { error: settingsErr.message };
  }

  console.log("[completeOnboarding] Successfully upserted app_settings for owner:", ownerId);

  // Return success - client will handle redirect
  if (isFirstCuber) {
    console.log("[completeOnboarding] First cuber - will redirect to home");
    return { error: null, redirectTo: "/" };
  } else {
    console.log("[completeOnboarding] Subsequent cuber - will redirect to user select");
    return { error: null, redirectTo: "/user-select" };
  }
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
