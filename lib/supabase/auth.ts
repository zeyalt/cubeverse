import type { User } from "@supabase/supabase-js";
import { createClient } from "./client";

export async function requireUser(): Promise<{
  db: ReturnType<typeof createClient>;
  user: User;
  ownerId: string;
}> {
  const db = createClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new Error("Authentication required");
  return { db, user: data.user, ownerId: data.user.id };
}
