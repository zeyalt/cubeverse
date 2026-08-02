import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecordType } from "./pb";
import type { CurrentPb } from "./analytics";

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
}

export const ACTIVITY_BADGES: ActivityBadge[] = [
  { key: "new_pb",                 label: "Personal Best",       description: "Set a new personal best" },
  { key: "first_comp",             label: "First Competition",   description: "Competed in your first competition" },
  { key: "5_comps",                label: "5 Competitions",      description: "Competed in 5 competitions" },
  { key: "100_solves",             label: "100 Solves",          description: "100 practice solves" },
  { key: "1000_solves",            label: "1000 Solves",         description: "1000 practice solves" },
  { key: "streak_7",               label: "Week Streak",         description: "7 days of practice in a row" },
  { key: "streak_30",              label: "Month Streak",        description: "30 days of practice in a row" },
  { key: "all_events_in_one_comp", label: "All Events",          description: "Competed in all 7 active events at one competition" },
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
  description?: string;
  eventId?: string;
  recordType?: RecordType;
}

/** Resolve a badge key to display metadata (tier or activity). */
export function getBadgeInfo(key: string): BadgeInfo {
  const tier = BADGE_TIERS.find((b) => b.key === key);
  if (tier) {
    return {
      key: tier.key,
      label: tier.label,
      eventId: tier.eventId,
      recordType: tier.recordType,
    };
  }
  const activity = ACTIVITY_BADGES.find((b) => b.key === key);
  if (activity) {
    return {
      key: activity.key,
      label: activity.label,
      description: activity.description,
    };
  }
  return { key, label: key.replace(/_/g, " ") };
}

/** All badge definitions for the achievements shelf (tiers + activity). */
export function getAllBadgeDefinitions(): BadgeInfo[] {
  const tiers = BADGE_TIERS.map((b) => getBadgeInfo(b.key));
  const activity = ACTIVITY_BADGES.map((b) => getBadgeInfo(b.key));
  return [...tiers, ...activity];
}

// ─── Progress helpers (pure — for the Badges tab UI) ─────────────────────────

/**
 * The time that actually unlocks a tier badge for this event/recordType —
 * whichever is faster of the practice PB and the official (WCA) PB, matching
 * how checkAndUnlockBadges gets triggered from both app/actions/solve.ts
 * (practice PBs) and app/actions/import.ts (official results).
 */
export function bestTimeForRecord(pb: CurrentPb, recordType: RecordType): number | null {
  const practice = recordType === "single" ? pb.practiceSingle : pb.practiceAo5;
  const official = recordType === "single" ? pb.officialSingle : pb.officialAvg;
  if (practice === null) return official;
  if (official === null) return practice;
  return Math.min(practice, official);
}

export interface NextTierInfo {
  tier: BadgeTier;
  progressPct: number;
  remainingCs: number;
}

/**
 * The next not-yet-beaten tier for an event/recordType, with how close the
 * current best is to it. Progress is anchored against the previous
 * (already-beaten) tier's threshold so it climbs from ~0 to 100 across that
 * rung specifically, rather than from an arbitrary global start; a cuber
 * with no previous tier yet is anchored to 1.6x the next threshold instead,
 * so a first-ever solve doesn't just read as "0%".
 */
export function getNextTier(
  eventId: string,
  recordType: RecordType,
  bestCs: number | null
): NextTierInfo | null {
  const tiers = BADGE_TIERS.filter((b) => b.eventId === eventId && b.recordType === recordType)
    .slice()
    .sort((a, b) => b.thresholdCs - a.thresholdCs); // easiest (largest threshold) first

  const nextIdx = tiers.findIndex((t) => bestCs === null || bestCs >= t.thresholdCs);
  if (nextIdx === -1) return null; // every tier already beaten

  const tier = tiers[nextIdx];
  const anchor = nextIdx > 0 ? tiers[nextIdx - 1].thresholdCs : tier.thresholdCs * 1.6;
  const remainingCs = bestCs === null ? tier.thresholdCs : Math.max(0, bestCs - tier.thresholdCs);
  const progressPct =
    bestCs === null
      ? 0
      : Math.min(100, Math.max(0, ((anchor - bestCs) / (anchor - tier.thresholdCs)) * 100));

  return { tier, progressPct, remainingCs };
}

/**
 * Fraction toward count/streak/comp activity badges (0-100), or null for
 * badges with no meaningful continuous progress (new_pb, one-off
 * all_events_in_one_comp).
 */
export function getActivityProgressPct(
  key: string,
  { solveCount, compCount, streak }: { solveCount?: number; compCount?: number; streak?: number }
): number | null {
  const pct = (value: number | undefined, target: number) =>
    value === undefined ? 0 : Math.min(100, (value / target) * 100);

  switch (key) {
    case "100_solves":
      return pct(solveCount, 100);
    case "1000_solves":
      return pct(solveCount, 1000);
    case "first_comp":
      return pct(compCount, 1);
    case "5_comps":
      return pct(compCount, 5);
    case "streak_7":
      return pct(streak, 7);
    case "streak_30":
      return pct(streak, 30);
    default:
      return null;
  }
}
