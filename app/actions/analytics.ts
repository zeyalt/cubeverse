"use server";

import { getServiceClient } from "@/lib/supabase/service";
import {
  getSolvesOverTime,
  getSolveDistribution,
  getConsistency,
  getPbStaircase,
  getCompetitionImprovements,
  getHeatmapCounts,
  type SolvesOverTimeData,
  type DistBin,
  type ConsistencyPoint,
  type PbStaircaseData,
  type CompetitionImprovement,
  type HeatmapCounts,
} from "@/lib/analytics";

export interface AnalyticsPayload {
  solvesOverTime: SolvesOverTimeData;
  distribution: DistBin[];
  consistency: ConsistencyPoint[];
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

  const [solvesOverTime, distribution, consistency, pbStaircase, competitionImprovements, heatmap, goal] =
    await Promise.all([
      getSolvesOverTime(db, cuberId, eventId),
      getSolveDistribution(db, cuberId, eventId),
      getConsistency(db, cuberId, eventId),
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
    consistency,
    pbStaircase,
    competitionImprovements,
    heatmap,
    targetCs: (goal.data?.target_cs as number | undefined) ?? null,
  };
}
