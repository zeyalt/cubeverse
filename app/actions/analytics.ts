"use server";

import { getServiceClient } from "@/lib/supabase/service";
import {
  getSolvesOverTime,
  getSolveDistribution,
  getPbStaircase,
  getCompetitionImprovements,
  getHeatmapCounts,
  type SolvesOverTimeData,
  type DistBin,
  type PbStaircaseData,
  type CompetitionImprovement,
  type HeatmapCounts,
} from "@/lib/analytics";

export interface AnalyticsPayload {
  solvesOverTime: SolvesOverTimeData;
  distribution: DistBin[];
  pbStaircase: PbStaircaseData;
  competitionImprovements: CompetitionImprovement[];
  heatmap: HeatmapCounts;
  /** Active practice single-target for this event, in centiseconds (null = none). */
  targetCs: number | null;
}

export async function getAnalyticsData(
  cuberId: string,
  eventId: string
): Promise<AnalyticsPayload> {
  const db = getServiceClient();

  const [solvesOverTime, distribution, pbStaircase, competitionImprovements, heatmap, goal] =
    await Promise.all([
      getSolvesOverTime(db, cuberId, eventId),
      getSolveDistribution(db, cuberId, eventId),
      getPbStaircase(db, cuberId, eventId),
      getCompetitionImprovements(db, cuberId, eventId),
      getHeatmapCounts(db, cuberId),
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
    distribution,
    pbStaircase,
    competitionImprovements,
    heatmap,
    targetCs: (goal.data?.target_cs as number | undefined) ?? null,
  };
}
