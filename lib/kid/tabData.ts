import type { AnalyticsPayload } from "@/lib/client/tabData";
import type { CurrentPb } from "@/lib/analytics";
import type { HistoricalSolve } from "@/lib/client/actions";
import type { CllTrainerProgress } from "@/lib/trainer/cll";

export type Tab = "practice" | "competitions" | "analytics" | "badges" | "trainer";

export interface EventRow {
  id: string;
  name: string;
  format: string;
}

export interface ShellData {
  cuberName: string;
  events: EventRow[];
  cubers: Array<{
    id: string;
    name: string;
    display_name: string | null;
    avatar_color: string;
  }>;
}

export interface PracticeTabData {
  events: EventRow[];
  defaultEventId: string;
  cuberId: string;
  activeGoal: { id: string; target_cs: number } | null;
  ao5: number | null;
  ao12: number | null;
  ao50: number | null;
  ao100: number | null;
  best: number | null;
  count: number;
  recentTimes: number[];
}

export interface CompetitionTabData {
  competitions: Array<{
    id: string;
    name: string;
    type: string;
    city: string | null;
    country: string | null;
    start_date: string | null;
    end_date: string | null;
    eventIds: string[];
  }>;
  cuberId: string;
  wcaId: string | null;
}

export interface AnalyticsTabData {
  events: EventRow[];
  defaultEventId: string;
  cuberId: string;
  initialAnalyticsData: AnalyticsPayload;
  pbs: CurrentPb[];
  wcaId: string | null;
  initialSessionTimes: HistoricalSolve[];
}

export interface BadgesTabData {
  achievements: Array<{
    badge_key: string;
    unlocked_at: string | null;
    metadata: Record<string, unknown> | null;
  }>;
  unlockedCount: number;
  totalCount: number;
  pbs: CurrentPb[];
  solveCount: number;
  compCount: number;
  streak: number;
}

export interface TrainerTabData {
  cuberId: string;
  progress: CllTrainerProgress;
}
