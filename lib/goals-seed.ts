import type { GoalRecordType } from "./goals";

export interface StarterGoal {
  eventId: string;
  recordType: GoalRecordType;
  targetCs: number;
  label: string;
}

/** Starter goals from spec Appendix A — reachable next targets for Zayyan. */
export const STARTER_GOALS: StarterGoal[] = [
  { eventId: "333", recordType: "average", targetCs: 1500, label: "Sub-15 3×3 Average" },
  { eventId: "333", recordType: "single", targetCs: 1200, label: "Sub-12 3×3 Single" },
  { eventId: "222", recordType: "average", targetCs: 500, label: "Sub-5 2×2 Average" },
  { eventId: "222", recordType: "single", targetCs: 400, label: "Sub-4 2×2 Single" },
  { eventId: "pyram", recordType: "average", targetCs: 1000, label: "Sub-10 Pyraminx Average" },
  { eventId: "skewb", recordType: "average", targetCs: 1000, label: "Sub-10 Skewb Average" },
  { eventId: "clock", recordType: "average", targetCs: 2000, label: "Sub-20 Clock Average" },
];
