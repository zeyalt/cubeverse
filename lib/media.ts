import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "media";

/** Create the public media bucket if it doesn't exist (service role only). */
async function ensureBucket(db: SupabaseClient): Promise<void> {
  const { error } = await db.storage.createBucket(BUCKET, { public: true });
  // Ignore "already exists" races; surface anything else.
  if (error && !/exist/i.test(error.message)) {
    throw new Error(`Could not create media bucket: ${error.message}`);
  }
}

export async function uploadMediaFile(
  db: SupabaseClient,
  ownerId: string,
  cuberId: string,
  file: File
): Promise<{ storagePath: string; publicUrl: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${ownerId}/${cuberId}/${crypto.randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const opts = { contentType: file.type || "image/jpeg", upsert: false };

  let { error } = await db.storage.from(BUCKET).upload(path, buffer, opts);

  // Self-heal if the bucket hasn't been provisioned in this Supabase project yet.
  if (error && /bucket not found/i.test(error.message)) {
    await ensureBucket(db);
    ({ error } = await db.storage.from(BUCKET).upload(path, buffer, opts));
  }

  if (error) throw new Error(error.message);

  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return { storagePath: path, publicUrl: data.publicUrl };
}

export function mediaPublicUrl(db: SupabaseClient, storagePath: string): string {
  const { data } = db.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}
