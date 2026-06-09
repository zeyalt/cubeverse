import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "media";

export async function uploadMediaFile(
  db: SupabaseClient,
  ownerId: string,
  cuberId: string,
  file: File
): Promise<{ storagePath: string; publicUrl: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${ownerId}/${cuberId}/${crypto.randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await db.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });

  if (error) throw new Error(error.message);

  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return { storagePath: path, publicUrl: data.publicUrl };
}

export function mediaPublicUrl(db: SupabaseClient, storagePath: string): string {
  const { data } = db.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}
