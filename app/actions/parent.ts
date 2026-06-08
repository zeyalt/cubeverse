"use server";

import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import { verifyPin } from "@/lib/pin";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const PARENT_COOKIE = "cubeverse_parent";
const EVENT_COOKIE = "cubeverse_event";
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

export type FormState = { error: string | null };

export async function verifyParentPin(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const pin = (formData.get("pin") as string)?.trim();
  if (!pin) return { error: "PIN is required." };

  const db = getServiceClient();
  const { data: settings } = await db
    .from("app_settings")
    .select("parent_pin_hash")
    .eq("owner_id", getOwnerId())
    .single();

  if (!settings?.parent_pin_hash) return { error: "No PIN set." };

  const ok = await verifyPin(pin, settings.parent_pin_hash);
  if (!ok) return { error: "Incorrect PIN. Try again." };

  const jar = await cookies();
  jar.set(PARENT_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  redirect("/parent");
}

export async function lockParentMode(): Promise<void> {
  const jar = await cookies();
  jar.delete(PARENT_COOKIE);
  redirect("/");
}

export async function setSelectedEvent(eventId: string): Promise<void> {
  const jar = await cookies();
  jar.set(EVENT_COOKIE, eventId, {
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
}
