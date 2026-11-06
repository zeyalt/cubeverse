import type { Phase } from "@/lib/smartcube/insights";
import type { StepName } from "@/lib/smartcube/analysis";

/**
 * Colours for the four CFOP phases, shared by the phase bar, the Insights splits and the TPS chart
 * so a phase is the same colour everywhere it appears.
 *
 * The hue walks from violet to green in solve order, so a bar reads left to right as a sequence.
 * All four clear 3:1 against the dark surface, the floor for data marks; labels never rely on
 * colour alone — every segment also carries its name.
 */
export const PHASE_COLOR: Record<Phase, string> = {
  cross: "#9b7fe0",
  f2l: "#6f74e6",
  oll: "#4a95e8",
  pll: "#3dbb92",
};

/** The four F2L pairs, as shades of the F2L hue: separate on one solve, one family at a glance. */
export const STEP_COLOR: Record<StepName, string> = {
  cross: PHASE_COLOR.cross,
  f2l1: "#7a7fea",
  f2l2: "#6f74e6",
  f2l3: "#6469dd",
  f2l4: "#595ed2",
  oll: PHASE_COLOR.oll,
  pll: PHASE_COLOR.pll,
};

/**
 * Worse / better than the goal, as theme tokens: the bright dark-theme pair falls to ~2.6:1 on the
 * light theme's paper. Always shown with a sign too, so colour is never the only signal.
 */
export const DELTA_WORSE = "var(--kid-worse)";
export const DELTA_BETTER = "var(--kid-better)";
