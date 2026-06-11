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
}

export async function getAnalyticsData(
  cuberId: string,
  eventId: string
): Promise<AnalyticsPayload> {
  const db = getServiceClient();

  const [solvesOverTime, distribution, consistency, pbStaircase, competitionImprovements, heatmap] =
    await Promise.all([
      getSolvesOverTime(db, cuberId, eventId),
      getSolveDistribution(db, cuberId, eventId),
      getConsistency(db, cuberId, eventId),
      getPbStaircase(db, cuberId, eventId),
      getCompetitionImprovements(db, cuberId, eventId),
      getHeatmapCounts(db, cuberId),
    ]);

  return {
    solvesOverTime,
    distribution,
    consistency,
    pbStaircase,
    competitionImprovements,
    heatmap,
  };
}
