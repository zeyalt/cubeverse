"use server";

import { getServiceClient } from "@/lib/supabase/service";
import {
  getSolvesOverTime,
  getPbStaircase,
  getCompetitionImprovements,
  type SolvesOverTimeData,
  type PbStaircaseData,
  type CompetitionImprovement,
} from "@/lib/analytics";

export interface AnalyticsPayload {
  solvesOverTime: SolvesOverTimeData;
  pbStaircase: PbStaircaseData;
  competitionImprovements: CompetitionImprovement[];
  /** Active practice single-target for this event, in centiseconds (null = none). */
  targetCs: number | null;
}

export async function getAnalyticsData(
  cuberId: string,
  eventId: string
): Promise<AnalyticsPayload> {
  const db = getServiceClient();

  const [solvesOverTime, pbStaircase, competitionImprovements, goal] =
    await Promise.all([
      getSolvesOverTime(db, cuberId, eventId),
      getPbStaircase(db, cuberId, eventId),
      getCompetitionImprovements(db, cuberId, eventId),
      db
        .from("goals")
        .select("target_cs")
        .eq("cuber_id", cuberId)
        .eq("event_id", eventId)
        .eq("record_type", "single")
        .eq("status", "active")
        .maybeSingle(),
    ]);

  return {
    solvesOverTime,
    pbStaircase,
    competitionImprovements,
    targetCs: (goal.data?.target_cs as number | undefined) ?? null,
  };
}
