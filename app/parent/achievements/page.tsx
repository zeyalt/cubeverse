import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerId } from "@/lib/owner";
import {
  BADGE_TIERS,
  ACTIVITY_BADGES,
  getBadgeInfo,
} from "@/lib/badges";
import { formatCs } from "@/lib/cubing";
import { PageHeader } from "@/components/parent/PageHeader";

export default async function AchievementsPage() {
  const db = getServiceClient();
  const ownerId = getOwnerId();

  const { data: settings } = await db
    .from("app_settings")
    .select("default_cuber_id")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!settings) {
    return <p className="text-muted-foreground text-sm">Run setup first.</p>;
  }

  const cuberId = settings.default_cuber_id as string;

  const { data: unlocked } = await db
    .from("achievements")
    .select("badge_key, unlocked_at, metadata")
    .eq("cuber_id", cuberId)
    .order("unlocked_at", { ascending: false });

  const unlockedMap = new Map(
    (unlocked ?? []).map((a) => [
      a.badge_key as string,
      {
        at: a.unlocked_at as string,
        metadata: a.metadata as Record<string, unknown>,
      },
    ])
  );

  const unlockedCount = unlockedMap.size;
  const totalCount = BADGE_TIERS.length + ACTIVITY_BADGES.length;
  const pct = Math.round((unlockedCount / totalCount) * 100);

  const eventGroups = new Map<string, typeof BADGE_TIERS>();
  for (const tier of BADGE_TIERS) {
    const list = eventGroups.get(tier.eventId) ?? [];
    list.push(tier);
    eventGroups.set(tier.eventId, list);
  }

  const EVENT_LABELS: Record<string, string> = {
    "333": "3×3×3",
    "222": "2×2×2",
    pyram: "Pyraminx",
    skewb: "Skewb",
    clock: "Clock",
    "444": "4×4×4",
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Achievements"
        description={`${unlockedCount} of ${totalCount} badges unlocked`}
      />

      <div className="parent-surface p-5 max-w-md">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Collection progress</span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Milestones
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      {[...eventGroups.entries()].map(([eventId, tiers]) => (
        <section key={eventId} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {EVENT_LABELS[eventId] ?? eventId}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {tiers.map((tier) => {
              const info = getBadgeInfo(tier.key);
              const u = unlockedMap.get(tier.key);
              const timeCs = u?.metadata?.time_cs as number | undefined;
              return (
                <BadgeCard
                  key={tier.key}
                  emoji={info.emoji}
                  label={info.label}
                  description={
                    timeCs ? `Achieved in ${formatCs(timeCs)}` : undefined
                  }
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
  unlockedAt?: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 text-center transition-all ${
        unlocked
          ? "border-amber-200 bg-gradient-to-b from-amber-50 to-orange-50/50 shadow-sm dark:border-amber-900/50 dark:from-amber-950/40 dark:to-orange-950/20"
          : "border-border bg-muted/30 opacity-55 grayscale"
      }`}
    >
      <div className="mb-2 text-3xl leading-none">{emoji}</div>
      <p className="text-xs font-semibold leading-tight text-foreground">{label}</p>
      {description && (
        <p className="mt-1 text-[10px] text-muted-foreground">{description}</p>
      )}
      {unlocked && unlockedAt && (
        <p className="mt-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">
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
