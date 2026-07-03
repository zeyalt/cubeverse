/**
 * Events that use the same physical puzzle, so they can share a cube collection.
 * e.g. 3x3, 3x3 One-Handed and 3x3 Blindfolded are all solved on a 3x3 cube.
 */
const HARDWARE_GROUPS: string[][] = [
  ["333", "333oh", "333bf"],
];

/** Returns every event that shares hardware with `eventId` (including itself). */
export function sharedHardwareEvents(eventId: string): string[] {
  const group = HARDWARE_GROUPS.find((g) => g.includes(eventId));
  return group ?? [eventId];
}
