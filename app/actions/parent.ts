"use server";

import { cookies } from "next/headers";

const EVENT_COOKIE = "cubeverse_event";

export async function setSelectedEvent(eventId: string): Promise<void> {
  const jar = await cookies();
  jar.set(EVENT_COOKIE, eventId, {
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
}
