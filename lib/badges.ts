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

// ─── Activity badges (count / streak / comp) ─────────────────────────────────

export interface ActivityBadge {
  key: string;
  label: string;
  description: string;
  emoji: string;
}

export const ACTIVITY_BADGES: ActivityBadge[] = [
  { key: "new_pb",                 label: "Personal Best",       emoji: "⭐", description: "Set a new personal best" },
  { key: "first_comp",             label: "First Competition",   emoji: "🏅", description: "Competed in your first competition" },
  { key: "5_comps",                label: "5 Competitions",      emoji: "🏆", description: "Competed in 5 competitions" },
  { key: "100_solves",             label: "100 Solves",          emoji: "💯", description: "100 practice solves" },
  { key: "1000_solves",            label: "1000 Solves",         emoji: "🚀", description: "1000 practice solves" },
  { key: "streak_7",               label: "Week Streak",         emoji: "🔥", description: "7 days of practice in a row" },
  { key: "streak_30",              label: "Month Streak",        emoji: "🌟", description: "30 days of practice in a row" },
  { key: "all_events_in_one_comp", label: "All Events",          emoji: "🎯", description: "Competed in all 7 active events at one competition" },
];

/**
 * Check and unlock activity badges (count/streak/competition-based).
 * Pass in already-computed values to avoid redundant DB queries.
 */
export async function checkActivityBadges(
  db: SupabaseClient,
  ownerId: string,
  cuberId: string,
  {
    solveCount,
    compCount,
    streak,
    newPb,
  }: {
    solveCount?: number;
    compCount?: number;
    streak?: number;
    newPb?: boolean;
  } = {}
): Promise<string[]> {
  const candidates: string[] = [];

  if (newPb) candidates.push("new_pb");

  if (solveCount !== undefined) {
    if (solveCount >= 100) candidates.push("100_solves");
    if (solveCount >= 1000) candidates.push("1000_solves");
  }

  if (compCount !== undefined) {
    if (compCount >= 1) candidates.push("first_comp");
    if (compCount >= 5) candidates.push("5_comps");
  }

  if (streak !== undefined) {
    if (streak >= 7) candidates.push("streak_7");
    if (streak >= 30) candidates.push("streak_30");
  }

  // all_events_in_one_comp: check lazily if compCount >= 1
  if (compCount && compCount >= 1) {
    const ACTIVE = ["333", "222", "pyram", "skewb", "clock", "444", "333oh"];
    const { data: comps } = await db
      .from("competitions")
      .select("id")
      .eq("cuber_id", cuberId);

    for (const comp of comps ?? []) {
      const { data: events } = await db
        .from("results")
        .select("event_id")
        .eq("competition_id", comp.id)
        .eq("cuber_id", cuberId);

      const eventSet = new Set((events ?? []).map((r) => r.event_id as string));
      if (ACTIVE.every((e) => eventSet.has(e))) {
        candidates.push("all_events_in_one_comp");
        break;
      }
    }
  }

  if (!candidates.length) return [];

  // Filter to not-yet-unlocked
  const { data: existing } = await db
    .from("achievements")
    .select("badge_key")
    .eq("cuber_id", cuberId)
    .in("badge_key", candidates);

  const alreadyUnlocked = new Set(
    (existing ?? []).map((r) => r.badge_key as string)
  );
  const toUnlock = candidates.filter((k) => !alreadyUnlocked.has(k));
  if (!toUnlock.length) return [];

  await db.from("achievements").insert(
    toUnlock.map((k) => ({
      owner_id: ownerId,
      cuber_id: cuberId,
      badge_key: k,
    }))
  );

  return toUnlock;
}

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

export interface BadgeInfo {
  key: string;
  label: string;
  emoji: string;
  description?: string;
  eventId?: string;
  recordType?: RecordType;
}

const TIER_EMOJI: Record<string, string> = {
  "333": "🧊",
  "222": "🟨",
  pyram: "🔺",
  skewb: "💎",
  clock: "🕐",
  "444": "🟧",
};

/** Resolve a badge key to display metadata (tier or activity). */
export function getBadgeInfo(key: string): BadgeInfo {
  const tier = BADGE_TIERS.find((b) => b.key === key);
  if (tier) {
    return {
      key: tier.key,
      label: tier.label,
      emoji: TIER_EMOJI[tier.eventId] ?? "🏅",
      eventId: tier.eventId,
      recordType: tier.recordType,
    };
  }
  const activity = ACTIVITY_BADGES.find((b) => b.key === key);
  if (activity) {
    return {
      key: activity.key,
      label: activity.label,
      emoji: activity.emoji,
      description: activity.description,
    };
  }
  return { key, label: key.replace(/_/g, " "), emoji: "🏅" };
}

/** All badge definitions for the achievements shelf (tiers + activity). */
export function getAllBadgeDefinitions(): BadgeInfo[] {
  const tiers = BADGE_TIERS.map((b) => getBadgeInfo(b.key));
  const activity = ACTIVITY_BADGES.map((b) => getBadgeInfo(b.key));
  return [...tiers, ...activity];
}
