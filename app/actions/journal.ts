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

export async function createJournalEntry(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const title = (formData.get("title") as string)?.trim() || null;
  const body = (formData.get("body") as string)?.trim() || null;
  const mood = (formData.get("mood") as string)?.trim() || null;
  const author = (formData.get("author") as string) || "parent";
  const entryDate = (formData.get("entry_date") as string) || new Date().toISOString().slice(0, 10);
  const competitionId = (formData.get("competition_id") as string) || null;
  const photo = formData.get("photo") as File | null;

  if (!body && !title) {
    return { error: "Write something — a title or body is required." };
  }

  const db = getServiceClient();
  const ownerId = getOwnerId();
  const cuberId = await getDefaultCuberId(db, ownerId);
  if (!cuberId) return { error: "No cuber set up." };

  const { data: entry, error } = await db
    .from("journal_entries")
    .insert({
      owner_id: ownerId,
      cuber_id: cuberId,
      competition_id: competitionId || null,
      entry_date: entryDate,
      mood,
      title,
      body,
      author,
    })
    .select("id")
    .single();

  if (error || !entry) return { error: error?.message ?? "Failed to save entry." };

  if (photo && photo.size > 0) {
    try {
      const { storagePath } = await uploadMediaFile(db, ownerId, cuberId, photo);
      await db.from("media").insert({
        owner_id: ownerId,
        cuber_id: cuberId,
        storage_path: storagePath,
        kind: photo.type.startsWith("video/") ? "video" : "image",
        linked_type: "journal",
        linked_id: entry.id,
      });
    } catch (e) {
      return { error: `Entry saved but photo upload failed: ${(e as Error).message}` };
    }
  }

  revalidatePath("/parent/journal");
  return { error: null };
}

export async function deleteJournalEntry(entryId: string): Promise<void> {
  const db = getServiceClient();

  const { data: linked } = await db
    .from("media")
    .select("storage_path")
    .eq("linked_type", "journal")
    .eq("linked_id", entryId);

  for (const m of linked ?? []) {
    await db.storage.from("media").remove([m.storage_path as string]);
  }
  await db.from("media").delete().eq("linked_type", "journal").eq("linked_id", entryId);
  await db.from("journal_entries").delete().eq("id", entryId);

  revalidatePath("/parent/journal");
}
