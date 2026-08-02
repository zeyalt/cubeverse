"use client";

import { useState } from "react";
import { formatCs } from "@/lib/cubing";
import {
  BADGE_TIERS,
  ACTIVITY_BADGES,
  getBadgeInfo,
  bestTimeForRecord,
  getNextTier,
  getActivityProgressPct,
  type BadgeTier,
} from "@/lib/badges";
import type { CurrentPb } from "@/lib/analytics";
import type { RecordType } from "@/lib/pb";
import {
  Star,
  Medal,
  Trophy,
  Hash,
  Rocket,
  Flame,
  CalendarCheck,
  Target,
  Timer,
  Gauge,
  Award,
  Sparkles,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { EventIcon } from "./EventIcon";

// Lucide icon per activity badge key (replaces emoji for a cleaner, consistent look).
const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  new_pb: Star,
  first_comp: Medal,
  "5_comps": Trophy,
  "100_solves": Hash,
  "1000_solves": Rocket,
  streak_7: Flame,
  streak_30: CalendarCheck,
  all_events_in_one_comp: Target,
};

// Tier badges: single = raw speed (Timer), average = consistency (Gauge).
function badgeIcon(key: string): LucideIcon {
  if (ACTIVITY_ICONS[key]) return ACTIVITY_ICONS[key];
  const info = getBadgeInfo(key);
  if (info.recordType === "average") return Gauge;
  if (info.recordType === "single") return Timer;
  return Award;
}

interface Achievement {
  badge_key: string;
  unlocked_at: string | null;
  metadata: Record<string, unknown> | null;
}

interface KidBadgesTabProps {
  data: {
    achievements: Achievement[];
    unlockedCount: number;
    totalCount: number;
    pbs: CurrentPb[];
    solveCount: number;
    compCount: number;
    streak: number;
  };
}

const EVENT_LABELS: Record<string, string> = {
  "333": "3×3×3",
  "222": "2×2×2",
  pyram: "Pyraminx",
  skewb: "Skewb",
  clock: "Clock",
  "444": "4×4×4",
};

const RECORD_LABEL: Record<RecordType, string> = { single: "Single", average: "Average" };

interface Rank {
  min: number;
  label: string;
  color: string;
}

// Reuses the app's existing accent palette rather than introducing a new one.
const RANKS: Rank[] = [
  { min: 100, label: "Diamond Cuber", color: "#5B9DFF" },
  { min: 75, label: "Gold Cuber", color: "#FFD500" },
  { min: 50, label: "Silver Cuber", color: "#C7CDD6" },
  { min: 25, label: "Bronze Cuber", color: "#CD7F32" },
  { min: 0, label: "Rookie Cuber", color: "#8A8578" },
];

function rankFor(pct: number): Rank {
  return RANKS.find((r) => pct >= r.min) ?? RANKS[RANKS.length - 1];
}

interface UpNextCandidate {
  key: string;
  icon: LucideIcon;
  label: string;
  progressPct: number;
  detail: string;
}

export function KidBadgesTab({
  data: { achievements, unlockedCount, totalCount, pbs, solveCount, compCount, streak },
}: KidBadgesTabProps) {
  const unlockedMap = new Map(
    achievements.map((a) => [a.badge_key, { at: a.unlocked_at, metadata: a.metadata }])
  );

  const pct = Math.round((unlockedCount / totalCount) * 100);
  const rank = rankFor(pct);

  const pbFor = (eventId: string) => pbs.find((p) => p.eventId === eventId);

  // One ladder per event × recordType, in BADGE_TIERS' own declared order
  // (easiest → hardest) — this is also what Up Next scans for candidates.
  const eventRecordGroups: { eventId: string; recordType: RecordType; tiers: BadgeTier[] }[] = [];
  for (const tier of BADGE_TIERS) {
    let group = eventRecordGroups.find(
      (g) => g.eventId === tier.eventId && g.recordType === tier.recordType
    );
    if (!group) {
      group = { eventId: tier.eventId, recordType: tier.recordType, tiers: [] };
      eventRecordGroups.push(group);
    }
    group.tiers.push(tier);
  }

  // ── Up Next: the single closest-to-unlocking badge across everything ──────
  const candidates: UpNextCandidate[] = [];

  for (const { eventId, recordType } of eventRecordGroups) {
    const bestCs = bestTimeForRecord(pbFor(eventId) ?? ({} as CurrentPb), recordType);
    const next = getNextTier(eventId, recordType, bestCs);
    if (!next) continue;
    candidates.push({
      key: next.tier.key,
      icon: badgeIcon(next.tier.key),
      label: next.tier.label,
      progressPct: next.progressPct,
      detail:
        bestCs === null
          ? "Log a solve to get started"
          : `${formatCs(next.remainingCs)} to go`,
    });
  }

  for (const badge of ACTIVITY_BADGES) {
    if (unlockedMap.has(badge.key)) continue;
    const activityPct = getActivityProgressPct(badge.key, { solveCount, compCount, streak });
    if (activityPct === null) continue;
    candidates.push({
      key: badge.key,
      icon: badgeIcon(badge.key),
      label: getBadgeInfo(badge.key).label,
      progressPct: activityPct,
      detail: badge.description,
    });
  }

  const upNext = candidates.sort((a, b) => b.progressPct - a.progressPct)[0];

  const sortedActivityBadges = [...ACTIVITY_BADGES].sort((a, b) => {
    const aUnlocked = unlockedMap.has(a.key);
    const bUnlocked = unlockedMap.has(b.key);
    if (aUnlocked !== bUnlocked) return aUnlocked ? 1 : -1;
    const aPct = getActivityProgressPct(a.key, { solveCount, compCount, streak }) ?? -1;
    const bPct = getActivityProgressPct(b.key, { solveCount, compCount, streak }) ?? -1;
    return bPct - aPct;
  });

  return (
    <div className="space-y-5 px-3 pt-2 pb-4">
      {/* Header + rank */}
      <div>
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-white">Badges</h2>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-display text-lg font-bold" style={{ color: rank.color }}>
            {rank.label}
          </span>
          <span className="text-xs font-bold text-white/40">
            {unlockedCount}/{totalCount} · {pct}%
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-strong">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: rank.color }}
          />
        </div>
      </div>

      {/* Up Next hero */}
      {upNext && (
        <div
          className="sticker rounded-2xl border-2 px-4 py-3.5"
          style={{ borderColor: "var(--kid-accent)", backgroundColor: "var(--accent-soft, rgba(255,213,0,0.08))" }}
        >
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--kid-accent)" }}>
            <Sparkles className="size-3.5" />
            Up Next
          </div>
          <div className="flex items-center gap-3">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--kid-accent)", color: "#0A0A0A" }}
            >
              <upNext.icon className="size-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white">{upNext.label}</p>
              <p className="text-xs text-white/60">{upNext.detail}</p>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-strong">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${upNext.progressPct}%`, backgroundColor: "var(--kid-accent)" }}
            />
          </div>
        </div>
      )}

      {/* Milestones */}
      {ACTIVITY_BADGES.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">Milestones</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {sortedActivityBadges.map((badge) => {
              const info = getBadgeInfo(badge.key);
              const u = unlockedMap.get(badge.key);
              const activityPct = getActivityProgressPct(badge.key, { solveCount, compCount, streak });
              return (
                <BadgeCard
                  key={badge.key}
                  icon={badgeIcon(badge.key)}
                  label={info.label}
                  description={badge.description}
                  unlocked={!!u}
                  unlockedAt={u?.at}
                  progressPct={u ? null : activityPct}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Event-based ladders */}
      {[...new Set(eventRecordGroups.map((g) => g.eventId))].map((eventId) => (
        <section key={eventId} className="space-y-3">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-white/40">
            <EventIcon event={eventId} className="text-sm" />
            {EVENT_LABELS[eventId] ?? eventId}
          </p>
          <div className="space-y-3">
            {eventRecordGroups
              .filter((g) => g.eventId === eventId)
              .map((g) => (
                <BadgeLadder
                  key={`${g.eventId}-${g.recordType}`}
                  recordType={g.recordType}
                  tiers={g.tiers}
                  bestCs={bestTimeForRecord(pbFor(g.eventId) ?? ({} as CurrentPb), g.recordType)}
                  unlockedMap={unlockedMap}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function BadgeLadder({
  recordType,
  tiers,
  bestCs,
  unlockedMap,
}: {
  recordType: RecordType;
  tiers: BadgeTier[];
  bestCs: number | null;
  unlockedMap: Map<string, { at: string | null; metadata: Record<string, unknown> | null }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const next = getNextTier(tiers[0].eventId, recordType, bestCs);
  const nextIdx = next ? tiers.findIndex((t) => t.key === next.tier.key) : -1;

  // Default view: every unlocked rung + the next one. Harder rungs beyond
  // that collapse behind "Show all" so the ladder doesn't dump every tier at
  // once.
  const visibleTiers = expanded ? tiers : tiers.slice(0, nextIdx === -1 ? tiers.length : nextIdx + 1);
  const hiddenCount = tiers.length - visibleTiers.length;

  return (
    <div className="surface space-y-1.5 px-3 py-3">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
        {recordType === "average" ? <Gauge className="size-3" /> : <Timer className="size-3" />}
        {RECORD_LABEL[recordType]}
      </p>
      <div className="space-y-1.5">
        {visibleTiers.map((tier) => {
          const u = unlockedMap.get(tier.key);
          const isNext = tier.key === next?.tier.key;
          const unlocked = !!u;
          const Icon = badgeIcon(tier.key);
          return (
            <div
              key={tier.key}
              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-all ${
                isNext ? "border-2" : "border border-transparent"
              } ${unlocked ? "bg-white/5" : isNext ? "" : "opacity-50"}`}
              style={isNext ? { borderColor: "var(--kid-accent)" } : undefined}
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                  unlocked ? "" : "bg-surface-strong text-token-muted"
                }`}
                style={unlocked ? { backgroundColor: "var(--kid-accent)", color: "#0A0A0A" } : undefined}
              >
                <Icon className="size-4" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-bold ${unlocked ? "text-white" : "text-white/70"}`}>
                  {tier.label}
                </p>
                {isNext && !unlocked && (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-strong">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${next!.progressPct}%`, backgroundColor: "var(--kid-accent)" }}
                    />
                  </div>
                )}
              </div>
              <span className="shrink-0 font-mono-time text-[11px] text-white/40">
                {unlocked && u.metadata?.time_cs
                  ? formatCs(u.metadata.time_cs as number)
                  : formatCs(tier.thresholdCs)}
              </span>
            </div>
          );
        })}
      </div>
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="flex w-full items-center justify-center gap-1 pt-1 text-[10px] font-bold text-white/40 hover:text-white/70"
        >
          Show {hiddenCount} more
          <ChevronDown className="size-3" />
        </button>
      )}
    </div>
  );
}

function BadgeCard({
  icon: Icon,
  label,
  description,
  unlocked,
  unlockedAt,
  progressPct,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  unlocked: boolean;
  unlockedAt?: string | null;
  progressPct?: number | null;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 text-center transition-all ${
        unlocked ? "border-accent bg-accent-soft" : "border-token bg-surface"
      }`}
    >
      <div className="mb-2.5 flex justify-center">
        <span
          className={`flex size-10 items-center justify-center rounded-full ${
            unlocked ? "bg-accent-soft" : "bg-surface-strong text-token-muted"
          }`}
          style={unlocked ? { color: "var(--kid-accent)" } : undefined}
        >
          <Icon className="size-5" strokeWidth={2} />
        </span>
      </div>
      <p className={`text-xs font-bold leading-tight ${unlocked ? "text-token" : "text-token-muted"}`}>{label}</p>
      {description && (
        <p className="mt-1 text-[10px] text-token-muted font-mono-time">{description}</p>
      )}
      {unlocked && unlockedAt && (
        <p className="mt-1 text-[9px] font-bold" style={{ color: "var(--kid-accent)" }}>
          {new Date(unlockedAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      )}
      {!unlocked && progressPct !== null && progressPct !== undefined && progressPct > 0 && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-strong">
          <div
            className="h-full rounded-full"
            style={{ width: `${progressPct}%`, backgroundColor: "var(--kid-accent)" }}
          />
        </div>
      )}
    </div>
  );
}
