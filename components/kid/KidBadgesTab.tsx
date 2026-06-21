"use client";

import { formatCs } from "@/lib/cubing";
import {
  BADGE_TIERS,
  ACTIVITY_BADGES,
  getBadgeInfo,
} from "@/lib/badges";
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

export function KidBadgesTab({
  data: { achievements, unlockedCount, totalCount },
}: KidBadgesTabProps) {
  const unlockedMap = new Map(
    achievements.map((a) => [
      a.badge_key,
      {
        at: a.unlocked_at,
        metadata: a.metadata,
      },
    ])
  );

  const pct = Math.round((unlockedCount / totalCount) * 100);

  const eventGroups = new Map<string, typeof BADGE_TIERS>();
  for (const tier of BADGE_TIERS) {
    const list = eventGroups.get(tier.eventId) ?? [];
    list.push(tier);
    eventGroups.set(tier.eventId, list);
  }

  return (
    <div className="space-y-6 px-5 pt-3 pb-6">
      {/* Header */}
      <div>
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-white">Badges</h2>
        <p className="mt-0.5 text-sm text-white/50">
          {unlockedCount} of {totalCount} unlocked
        </p>
      </div>

      {/* Progress bar */}
      <div className="surface px-4 py-3.5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-token">Progress</span>
          <span className="font-display font-bold" style={{ color: "var(--kid-accent)" }}>
            {pct}%
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-surface-strong">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: "var(--kid-accent)" }}
          />
        </div>
      </div>

      {/* Milestones */}
      {ACTIVITY_BADGES.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">
            Milestones
          </p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {ACTIVITY_BADGES.map((badge) => {
              const info = getBadgeInfo(badge.key);
              const u = unlockedMap.get(badge.key);
              return (
                <BadgeCard
                  key={badge.key}
                  icon={badgeIcon(badge.key)}
                  label={info.label}
                  description={badge.description}
                  unlocked={!!u}
                  unlockedAt={u?.at}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Event-based badges */}
      {[...eventGroups.entries()].map(([eventId, tiers]) => (
        <section key={eventId} className="space-y-3">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-white/40">
            <EventIcon event={eventId} className="text-sm" />
            {EVENT_LABELS[eventId] ?? eventId}
          </p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {tiers.map((tier) => {
              const info = getBadgeInfo(tier.key);
              const u = unlockedMap.get(tier.key);
              const timeCs = u?.metadata?.time_cs as number | undefined;
              return (
                <BadgeCard
                  key={tier.key}
                  icon={badgeIcon(tier.key)}
                  label={info.label}
                  description={timeCs ? `${formatCs(timeCs)}` : undefined}
                  unlocked={!!u}
                  unlockedAt={u?.at}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function BadgeCard({
  icon: Icon,
  label,
  description,
  unlocked,
  unlockedAt,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  unlocked: boolean;
  unlockedAt?: string | null;
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
    </div>
  );
}
