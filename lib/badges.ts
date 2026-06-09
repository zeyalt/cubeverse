import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecordType } from "./pb";

export interface BadgeTier {
  key: string;
  label: string;
  eventId: string;
  recordType: RecordType;
  thresholdCs: number; // time must be LESS THAN this to unlock
}

/**
 * Tiered threshold badges — one rung per event/record-type combination.
 * Times in centiseconds (e.g. sub-20 333 single → thresholdCs = 2000).
 */
export const BADGE_TIERS: BadgeTier[] = [
  // 333 single
  { key: "sub20_333_single",  label: "Sub-20 3×3 Single",     eventId: "333",  recordType: "single",  thresholdCs: 2000 },
  { key: "sub15_333_single",  label: "Sub-15 3×3 Single",     eventId: "333",  recordType: "single",  thresholdCs: 1500 },
  { key: "sub12_333_single",  label: "Sub-12 3×3 Single",     eventId: "333",  recordType: "single",  thresholdCs: 1200 },
  { key: "sub10_333_single",  label: "Sub-10 3×3 Single",     eventId: "333",  recordType: "single",  thresholdCs: 1000 },
  { key: "sub8_333_single",   label: "Sub-8 3×3 Single",      eventId: "333",  recordType: "single",  thresholdCs:  800 },
  // 333 average
  { key: "sub20_333_average", label: "Sub-20 3×3 Average",    eventId: "333",  recordType: "average", thresholdCs: 2000 },
  { key: "sub15_333_average", label: "Sub-15 3×3 Average",    eventId: "333",  recordType: "average", thresholdCs: 1500 },
  { key: "sub12_333_average", label: "Sub-12 3×3 Average",    eventId: "333",  recordType: "average", thresholdCs: 1200 },
  { key: "sub10_333_average", label: "Sub-10 3×3 Average",    eventId: "333",  recordType: "average", thresholdCs: 1000 },
  // 222 single
  { key: "sub8_222_single",   label: "Sub-8 2×2 Single",      eventId: "222",  recordType: "single",  thresholdCs:  800 },
  { key: "sub6_222_single",   label: "Sub-6 2×2 Single",      eventId: "222",  recordType: "single",  thresholdCs:  600 },
  { key: "sub5_222_single",   label: "Sub-5 2×2 Single",      eventId: "222",  recordType: "single",  thresholdCs:  500 },
  { key: "sub4_222_single",   label: "Sub-4 2×2 Single",      eventId: "222",  recordType: "single",  thresholdCs:  400 },
  { key: "sub3_222_single",   label: "Sub-3 2×2 Single",      eventId: "222",  recordType: "single",  thresholdCs:  300 },
  // 222 average
  { key: "sub8_222_average",  label: "Sub-8 2×2 Average",     eventId: "222",  recordType: "average", thresholdCs:  800 },
  { key: "sub6_222_average",  label: "Sub-6 2×2 Average",     eventId: "222",  recordType: "average", thresholdCs:  600 },
  { key: "sub5_222_average",  label: "Sub-5 2×2 Average",     eventId: "222",  recordType: "average", thresholdCs:  500 },
  { key: "sub4_222_average",  label: "Sub-4 2×2 Average",     eventId: "222",  recordType: "average", thresholdCs:  400 },
  // pyram
  { key: "sub15_pyram_single",  label: "Sub-15 Pyraminx Single",  eventId: "pyram", recordType: "single",  thresholdCs: 1500 },
  { key: "sub12_pyram_single",  label: "Sub-12 Pyraminx Single",  eventId: "pyram", recordType: "single",  thresholdCs: 1200 },
  { key: "sub10_pyram_single",  label: "Sub-10 Pyraminx Single",  eventId: "pyram", recordType: "single",  thresholdCs: 1000 },
  { key: "sub8_pyram_single",   label: "Sub-8 Pyraminx Single",   eventId: "pyram", recordType: "single",  thresholdCs:  800 },
  { key: "sub6_pyram_single",   label: "Sub-6 Pyraminx Single",   eventId: "pyram", recordType: "single",  thresholdCs:  600 },
  { key: "sub15_pyram_average", label: "Sub-15 Pyraminx Average", eventId: "pyram", recordType: "average", thresholdCs: 1500 },
  { key: "sub12_pyram_average", label: "Sub-12 Pyraminx Average", eventId: "pyram", recordType: "average", thresholdCs: 1200 },
  { key: "sub10_pyram_average", label: "Sub-10 Pyraminx Average", eventId: "pyram", recordType: "average", thresholdCs: 1000 },
  // skewb
  { key: "sub15_skewb_single",  label: "Sub-15 Skewb Single",     eventId: "skewb", recordType: "single",  thresholdCs: 1500 },
  { key: "sub12_skewb_single",  label: "Sub-12 Skewb Single",     eventId: "skewb", recordType: "single",  thresholdCs: 1200 },
  { key: "sub10_skewb_single",  label: "Sub-10 Skewb Single",     eventId: "skewb", recordType: "single",  thresholdCs: 1000 },
  { key: "sub8_skewb_single",   label: "Sub-8 Skewb Single",      eventId: "skewb", recordType: "single",  thresholdCs:  800 },
  { key: "sub15_skewb_average", label: "Sub-15 Skewb Average",    eventId: "skewb", recordType: "average", thresholdCs: 1500 },
  { key: "sub12_skewb_average", label: "Sub-12 Skewb Average",    eventId: "skewb", recordType: "average", thresholdCs: 1200 },
  { key: "sub10_skewb_average", label: "Sub-10 Skewb Average",    eventId: "skewb", recordType: "average", thresholdCs: 1000 },
  { key: "sub8_skewb_average",  label: "Sub-8 Skewb Average",     eventId: "skewb", recordType: "average", thresholdCs:  800 },
  // clock
  { key: "sub25_clock_single",  label: "Sub-25 Clock Single",     eventId: "clock", recordType: "single",  thresholdCs: 2500 },
  { key: "sub20_clock_single",  label: "Sub-20 Clock Single",     eventId: "clock", recordType: "single",  thresholdCs: 2000 },
  { key: "sub18_clock_single",  label: "Sub-18 Clock Single",     eventId: "clock", recordType: "single",  thresholdCs: 1800 },
  { key: "sub15_clock_single",  label: "Sub-15 Clock Single",     eventId: "clock", recordType: "single",  thresholdCs: 1500 },
  { key: "sub25_clock_average", label: "Sub-25 Clock Average",    eventId: "clock", recordType: "average", thresholdCs: 2500 },
  { key: "sub20_clock_average", label: "Sub-20 Clock Average",    eventId: "clock", recordType: "average", thresholdCs: 2000 },
  { key: "sub18_clock_average", label: "Sub-18 Clock Average",    eventId: "clock", recordType: "average", thresholdCs: 1800 },
  // 444
  { key: "sub90_444_single",    label: "Sub-1:30 4×4 Single",     eventId: "444",   recordType: "single",  thresholdCs: 9000 },
  { key: "sub80_444_single",    label: "Sub-1:20 4×4 Single",     eventId: "444",   recordType: "single",  thresholdCs: 8000 },
  { key: "sub70_444_single",    label: "Sub-1:10 4×4 Single",     eventId: "444",   recordType: "single",  thresholdCs: 7000 },
  { key: "sub60_444_single",    label: "Sub-1:00 4×4 Single",     eventId: "444",   recordType: "single",  thresholdCs: 6000 },
  { key: "sub90_444_average",   label: "Sub-1:30 4×4 Average",    eventId: "444",   recordType: "average", thresholdCs: 9000 },
  { key: "sub80_444_average",   label: "Sub-1:20 4×4 Average",    eventId: "444",   recordType: "average", thresholdCs: 8000 },
];

/**
 * Check which threshold badges should be unlocked for a given time.
 * Inserts new rows into `achievements` (unique per cuber+badge_key).
 * Returns the keys of newly unlocked badges.
 */
export async function checkAndUnlockBadges(
  db: SupabaseClient,
  ownerId: string,
  cuberId: string,
  eventId: string,
  recordType: RecordType,
  timeCs: number
): Promise<string[]> {
  if (timeCs <= 0) return [];

  const applicable = BADGE_TIERS.filter(
    (b) => b.eventId === eventId && b.recordType === recordType && timeCs < b.thresholdCs
  );
  if (!applicable.length) return [];

  // Find which ones are not yet unlocked for this cuber
  const keys = applicable.map((b) => b.key);
  const { data: existing } = await db
    .from("achievements")
    .select("badge_key")
    .eq("cuber_id", cuberId)
    .in("badge_key", keys);

  const alreadyUnlocked = new Set((existing ?? []).map((r) => r.badge_key as string));
  const toUnlock = applicable.filter((b) => !alreadyUnlocked.has(b.key));
  if (!toUnlock.length) return [];

  await db.from("achievements").insert(
    toUnlock.map((b) => ({
      owner_id: ownerId,
      cuber_id: cuberId,
      badge_key: b.key,
      event_id: eventId,
      metadata: { time_cs: timeCs },
    }))
  );

  return toUnlock.map((b) => b.key);
}
