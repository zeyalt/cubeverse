/**
 * Single source of truth for Recharts colours across the analytics charts.
 * Recharts renders SVG and needs concrete colour strings (CSS variables don't
 * resolve in SVG presentation attributes), so colours are picked here per theme.
 * Both charts import this so light/dark stay consistent and can't drift apart.
 */
export interface ChartColors {
  tick: string;        // axis tick labels
  axis: string;        // axis lines / tick marks
  grid: string;        // gridlines
  scatter: string;     // individual-solve dots
  bar: string;         // distribution bars
  markerStroke: string; // outline of the competition marker dot
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  avgAo5: string;       // Solves Over Time rolling-average lines
  avgAo12: string;
  avgAo50: string;
}

const LIGHT: ChartColors = {
  tick: "#3D3428",          // strong warm ink — clearly readable on paper
  axis: "rgba(26,18,8,0.45)",
  grid: "rgba(26,18,8,0.12)",
  scatter: "rgba(26,18,8,0.55)",
  bar: "#0046AD",
  markerStroke: "#FFFCF7",
  tooltipBg: "rgba(255,252,247,0.97)",
  tooltipBorder: "1px solid rgba(26,18,8,0.15)",
  tooltipText: "#1A1208",
  avgAo5: "#B45309",   // amber-700 — the raw gold is too pale against paper
  avgAo12: "#0046AD",
  avgAo50: "#009B48",
};

const DARK: ChartColors = {
  tick: "#E8E0D2",          // near-white — clearly readable on the dark canvas
  axis: "rgba(255,255,255,0.5)",
  grid: "rgba(255,255,255,0.14)",
  scatter: "rgba(255,255,255,0.65)",
  bar: "#4F8FF7",
  markerStroke: "#0A0A0A",
  tooltipBg: "rgba(0,0,0,0.85)",
  tooltipBorder: "1px solid rgba(255,255,255,0.12)",
  tooltipText: "#ffffff",
  avgAo5: "#FFD500",   // already bright against near-black — kept as-is
  avgAo12: "#5B9DFF",  // the old #0046AD read almost black on dark canvas
  avgAo50: "#2ED573",
};

export function chartColors(theme: "light" | "dark"): ChartColors {
  return theme === "light" ? LIGHT : DARK;
}

/**
 * Static categorical palette for the Competitor Benchmarking chart, one color
 * per line. Hardcoded rather than theme-branched, matching PbStaircase's
 * convention. Index 0 (gold) is reserved for "You".
 */
export const COMPETITOR_PALETTE = ["#FFD500", "#5B9DFF", "#2ED573", "#FF6B6B", "#C084FC", "#FF9F40"];
