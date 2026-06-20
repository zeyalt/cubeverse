"use client";

import type { HeatmapCounts } from "@/lib/analytics";

interface Props {
  counts: HeatmapCounts;
  weeks?: number;
  /** Optional explicit window (YYYY-MM-DD). When provided, the grid spans this range. */
  startDate?: string;
  endDate?: string;
}

function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildGrid(
  counts: HeatmapCounts,
  weeks: number,
  startDate?: string,
  endDate?: string
) {
  // Determine the end of the window (defaults to today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowEnd = endDate ? new Date(endDate + "T00:00:00") : today;
  windowEnd.setHours(0, 0, 0, 0);

  // Determine the start of the window
  let windowStart: Date;
  if (startDate) {
    windowStart = new Date(startDate + "T00:00:00");
  } else {
    windowStart = new Date(windowEnd);
    windowStart.setDate(windowEnd.getDate() - (weeks - 1) * 7);
  }
  windowStart.setHours(0, 0, 0, 0);

  // Align grid start to the Sunday of the window-start week
  const startDay = new Date(windowStart);
  startDay.setDate(windowStart.getDate() - windowStart.getDay());

  // Align grid end to the Saturday of the window-end week
  const end = new Date(windowEnd);
  end.setDate(windowEnd.getDate() + (6 - windowEnd.getDay()));

  const startYMD = toYMD(windowStart);
  const endYMD = toYMD(windowEnd);

  const days: { date: string; count: number; col: number; row: number; inRange: boolean }[] = [];

  let col = 0;
  const cursor = new Date(startDay);
  while (cursor <= end) {
    const row = cursor.getDay(); // 0=Sun … 6=Sat
    if (row === 0 && cursor > startDay) col++;
    const ymd = toYMD(cursor);
    const inRange = ymd >= startYMD && ymd <= endYMD;
    days.push({ date: ymd, count: inRange ? counts[ymd] ?? 0 : 0, col, row, inRange });
    cursor.setDate(cursor.getDate() + 1);
  }
  return { days, cols: col + 1 };
}

// Filled-intensity classes (work on both themes). Empty cells use a theme
// token so they read against both the dark and the light paper canvas.
function intensityClass(count: number, max: number): string {
  if (count === 0) return "heat-empty";
  const intensity = Math.ceil((count / Math.max(max, 1)) * 4);
  return [
    "bg-[#6B9AE8]",
    "bg-[#3D7BDD]",
    "bg-[#0046AD]",
    "bg-[#002D6E]",
  ][intensity - 1] ?? "bg-[#002D6E]";
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export function PracticeHeatmap({ counts, weeks = 52, startDate, endDate }: Props) {
  const { days, cols } = buildGrid(counts, weeks, startDate, endDate);
  const inRangeCounts = days.filter((d) => d.inRange).map((d) => d.count);
  const max = Math.max(...inRangeCounts, 1);

  // Build month labels (include year when it changes across the range)
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  const yearsInRange = new Set(days.filter((d) => d.inRange).map((d) => d.date.slice(0, 4)));
  const showYearInLabel = yearsInRange.size > 1;
  for (const d of days) {
    const dt = new Date(d.date);
    const m = dt.getMonth();
    if (m !== lastMonth && d.row === 0) {
      const label = showYearInLabel ? `${MONTHS[m]} '${d.date.slice(2, 4)}` : MONTHS[m];
      monthLabels.push({ col: d.col, label });
      lastMonth = m;
    }
  }

  // Year label(s) for the range, e.g. "2025" or "2025–2026"
  const sortedYears = [...yearsInRange].sort();
  const yearLabel =
    sortedYears.length === 0
      ? ""
      : sortedYears.length === 1
      ? sortedYears[0]
      : `${sortedYears[0]}–${sortedYears[sortedYears.length - 1]}`;

  // Recent dates on the left: flip column order for display
  const flip = (c: number) => cols - 1 - c;

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-0.5 min-w-max">
        {/* Year label */}
        {yearLabel && (
          <div className="ml-8 mb-0.5 text-token-muted font-bold" style={{ fontSize: 10 }}>
            {yearLabel}
          </div>
        )}

        {/* Month labels */}
        <div className="flex ml-8" style={{ gap: "2px" }}>
          {Array.from({ length: cols }, (_, c) => {
            const lbl = monthLabels.find((m) => m.col === flip(c));
            return (
              <div key={c} className="text-xs text-token-muted shrink-0" style={{ fontSize: 9, width: "14px" }}>
                {lbl?.label ?? ""}
              </div>
            );
          })}
        </div>

        {/* Day rows */}
        {[0, 1, 2, 3, 4, 5, 6].map((row) => (
          <div key={row} className="flex items-center gap-0.5">
            <span className="w-7 text-right text-token-muted mr-1 shrink-0" style={{ fontSize: 9 }}>
              {DAYS[row]}
            </span>
            {Array.from({ length: cols }, (_, c) => {
              const col = flip(c);
              const cell = days.find((d) => d.col === col && d.row === row);
              if (!cell || !cell.inRange) return <div key={c} className="w-3.5 h-3.5 shrink-0" />;
              return (
                <div
                  key={c}
                  title={`${cell.date}: ${cell.count} solve${cell.count !== 1 ? "s" : ""}`}
                  className={`w-3.5 h-3.5 rounded-sm shrink-0 ${intensityClass(cell.count, max)}`}
                />
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-1.5 mt-4 mb-1 ml-8 text-token-muted" style={{ fontSize: 10 }}>
          <span className="mr-0.5">Less</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`w-3.5 h-3.5 rounded-sm ${i === 0 ? "heat-empty" : intensityClass(i, 4)}`} />
          ))}
          <span className="ml-0.5">More</span>
        </div>
      </div>
    </div>
  );
}
