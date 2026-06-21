/**
 * Persist the selected puzzle/event so it's shared across tabs (practice,
 * analytics, cubes, timer). The server reads `cubeverse_event` in page.tsx to
 * seed each tab's default event; writing it here keeps every filter in sync the
 * next time a tab is rendered.
 */
export function setEventCookie(eventId: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `cubeverse_event=${eventId}; path=/; max-age=31536000; samesite=lax`;
}
