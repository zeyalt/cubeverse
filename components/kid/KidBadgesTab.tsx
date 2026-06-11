"use client";

import { formatCs } from "@/lib/cubing";
import {
  BADGE_TIERS,
  ACTIVITY_BADGES,
  getBadgeInfo,
} from "@/lib/badges";

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
    <div className="space-y-6 px-5 py-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-extrabold text-white">Badges</h2>
        <p className="text-sm text-white/60">
          {unlockedCount} of {totalCount} unlocked
        </p>
      </div>

      {/* Progress bar */}
      <div className="sticker rounded-xl bg-white/8 border border-white/10 px-4 py-3" style={{ boxShadow: "2px 2px 0 rgba(0,0,0,0.2)" }}>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-white/90">Progress</span>
          <span className="font-display font-bold" style={{ color: "#FFD500" }}>
            {pct}%
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: "#FFD500" }}
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
                  emoji={info.emoji}
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
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">
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
                  emoji={info.emoji}
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
  emoji,
  label,
  description,
  unlocked,
  unlockedAt,
}: {
  emoji: string;
  label: string;
  description?: string;
  unlocked: boolean;
  unlockedAt?: string | null;
}) {
  return (
    <div
      className={`sticker rounded-2xl border-2 p-3 text-center transition-all ${
        unlocked
          ? "border-[#FFD500]/40 bg-[#FFD500]/10"
          : "border-white/10 bg-white/5 opacity-50 grayscale"
      }`}
      style={{
        boxShadow: unlocked ? "2px 2px 0 #FFD500" : "1px 1px 0 rgba(0,0,0,0.2)",
      }}
    >
      <div className="mb-2 text-3xl leading-none filter drop-shadow-sm">{emoji}</div>
      <p className="text-xs font-bold leading-tight text-white">{label}</p>
      {description && (
        <p className="mt-1 text-[10px] text-white/60 font-mono-time">{description}</p>
      )}
      {unlocked && unlockedAt && (
        <p className="mt-1 text-[9px] font-medium text-[#FFD500]">
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
