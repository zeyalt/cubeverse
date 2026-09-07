/**
 * Persist the selected puzzle/event so it's shared across tabs (practice,
 * analytics, timer). The cookie is written so a full reload also starts here.
 */
export function setEventCookie(eventId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("cubeverse_event", eventId);
  document.cookie = `cubeverse_event=${eventId}; path=/; max-age=31536000; samesite=lax`;
}
