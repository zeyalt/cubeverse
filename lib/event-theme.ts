/** WCA-inspired sticker palette + per-event identity for kid mode. */
export const EVENT_SHORT: Record<string, string> = {
  "333": "3×3",
  "222": "2×2",
  pyram: "Pyraminx",
  skewb: "Skewb",
  clock: "Clock",
  "444": "4×4",
  "333oh": "3×3 OH",
};

export interface EventSticker {
  /** Sticker face color */
  face: string;
  /** Text on sticker */
  ink: string;
  /** Glow / accent */
  glow: string;
  /** Tailwind-friendly label */
  name: string;
}

export const EVENT_STICKERS: Record<string, EventSticker> = {
  "333": { face: "#0046AD", ink: "#FFFFFF", glow: "#4F8FF7", name: "Cube Blue" },
  "222": { face: "#FFD500", ink: "#1A1200", glow: "#FFE566", name: "Sticker Yellow" },
  pyram: { face: "#009B48", ink: "#FFFFFF", glow: "#3DD68C", name: "Sticker Green" },
  skewb: { face: "#FF5800", ink: "#FFFFFF", glow: "#FF8F4D", name: "Sticker Orange" },
  clock: { face: "#F4F4F4", ink: "#1A1A1A", glow: "#FFFFFF", name: "Sticker White" },
  "444": { face: "#B71234", ink: "#FFFFFF", glow: "#E84D6A", name: "Sticker Red" },
  "333oh": { face: "#7C3AED", ink: "#FFFFFF", glow: "#A78BFA", name: "One-hand Purple" },
};

export function getEventSticker(eventId: string): EventSticker {
  return EVENT_STICKERS[eventId] ?? EVENT_STICKERS["333"];
}
