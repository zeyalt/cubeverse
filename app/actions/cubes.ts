"use server";

import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { uploadMediaFile } from "@/lib/media";

export type FormState = { error: string | null };

async function getDefaultCuberId(db: ReturnType<typeof getServiceClient>, ownerId: string) {
  const { data } = await db
    .from("app_settings")
    .select("default_cuber_id")
    .eq("owner_id", ownerId)
    .single();
  return data?.default_cuber_id as string | null;
}

export async function createCube(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Cube name is required." };

  const db = getServiceClient();
  const ownerId = getOwnerId();
  const cuberId = await getDefaultCuberId(db, ownerId);
  if (!cuberId) return { error: "No cuber set up." };

  const eventId = (formData.get("event_id") as string) || null;
  const brand = (formData.get("brand") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const acquiredOn = (formData.get("acquired_on") as string) || null;
  const isMain = formData.get("is_main") === "on";
  const photo = formData.get("photo") as File | null;

  if (isMain && eventId) {
    await db
      .from("cubes")
      .update({ is_main: false })
      .eq("cuber_id", cuberId)
      .eq("event_id", eventId);
  }

  let photoUrl: string | null = null;
  if (photo && photo.size > 0) {
    try {
      const { publicUrl } = await uploadMediaFile(db, ownerId, cuberId, photo);
      photoUrl = publicUrl;
    } catch (e) {
      return { error: `Photo upload failed: ${(e as Error).message}` };
    }
  }

  const { error } = await db.from("cubes").insert({
    owner_id: ownerId,
    cuber_id: cuberId,
    event_id: eventId,
    name,
    brand,
    notes,
    acquired_on: acquiredOn,
    is_main: isMain,
    photo_url: photoUrl,
  });

  if (error) return { error: error.message };

  revalidatePath("/parent/cubes");
  return { error: null };
}

export async function setMainCube(cubeId: string, eventId: string | null): Promise<void> {
  const db = getServiceClient();
  const ownerId = getOwnerId();

  if (eventId) {
    const { data: cube } = await db
      .from("cubes")
      .select("cuber_id")
      .eq("id", cubeId)
      .single();

    if (cube) {
      await db
        .from("cubes")
        .update({ is_main: false })
        .eq("cuber_id", cube.cuber_id)
        .eq("event_id", eventId);
    }
  }

  await db.from("cubes").update({ is_main: true }).eq("id", cubeId).eq("owner_id", ownerId);
  revalidatePath("/parent/cubes");
}

export async function deleteCube(cubeId: string): Promise<void> {
  const db = getServiceClient();
  await db.from("cubes").delete().eq("id", cubeId);
  revalidatePath("/parent/cubes");
}
