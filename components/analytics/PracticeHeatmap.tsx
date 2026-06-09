"use client";

import type { HeatmapCounts } from "@/lib/analytics";

interface Props {
  counts: HeatmapCounts;
  weeks?: number;
}

function toYMD(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildGrid(counts: HeatmapCounts, weeks: number) {
  // Align to Sunday of the week "weeks" weeks ago
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDay = new Date(today);
  startDay.setDate(today.getDate() - today.getDay()); // start of this week (Sun)
  startDay.setDate(startDay.getDate() - (weeks - 1) * 7);

  const days: { date: string; count: number; col: number; row: number }[] = [];
  const end = new Date(today);
  end.setDate(today.getDate() + (6 - today.getDay())); // end of this week

  let col = 0;
  const cursor = new Date(startDay);
  while (cursor <= end) {
    const row = cursor.getDay(); // 0=Sun … 6=Sat
    if (row === 0 && cursor > startDay) col++;
    const ymd = toYMD(cursor);
    days.push({ date: ymd, count: counts[ymd] ?? 0, col, row });
    cursor.setDate(cursor.getDate() + 1);
  }
  return { days, cols: col + 1 };
}

function cellColor(count: number, max: number): string {
  if (count === 0) return "bg-zinc-100 dark:bg-zinc-800";
  const intensity = Math.ceil((count / Math.max(max, 1)) * 4);
  return [
    "bg-indigo-200 dark:bg-indigo-900",
    "bg-indigo-300 dark:bg-indigo-700",
    "bg-indigo-500 dark:bg-indigo-500",
    "bg-indigo-700 dark:bg-indigo-300",
  ][intensity - 1] ?? "bg-indigo-700";
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export function PracticeHeatmap({ counts, weeks = 52 }: Props) {
  const { days, cols } = buildGrid(counts, weeks);
  const max = Math.max(...Object.values(counts), 1);

  // Build month labels
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (const d of days) {
    const m = new Date(d.date).getMonth();
    if (m !== lastMonth && d.row === 0) {
      monthLabels.push({ col: d.col, label: MONTHS[m] });
      lastMonth = m;
    }
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-0.5 min-w-max">
        {/* Month labels */}
        <div className="flex ml-7" style={{ gap: "2px" }}>
          {Array.from({ length: cols }, (_, c) => {
            const lbl = monthLabels.find((m) => m.col === c);
            return (
              <div key={c} className="w-3 text-xs text-zinc-400 shrink-0" style={{ fontSize: 9 }}>
                {lbl?.label ?? ""}
              </div>
            );
          })}
        </div>

        {/* Day rows */}
        {[0, 1, 2, 3, 4, 5, 6].map((row) => (
          <div key={row} className="flex items-center gap-0.5">
            <span className="w-6 text-right text-zinc-300 dark:text-zinc-600 mr-1 shrink-0" style={{ fontSize: 9 }}>
              {row % 2 === 1 ? DAYS[row] : ""}
            </span>
            {Array.from({ length: cols }, (_, col) => {
              const cell = days.find((d) => d.col === col && d.row === row);
              if (!cell) return <div key={col} className="w-3 h-3 shrink-0" />;
              return (
                <div
                  key={col}
                  title={`${cell.date}: ${cell.count} solve${cell.count !== 1 ? "s" : ""}`}
                  className={`w-3 h-3 rounded-sm shrink-0 ${cellColor(cell.count, max)}`}
                />
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-1 mt-1 ml-7 text-zinc-400" style={{ fontSize: 10 }}>
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`w-3 h-3 rounded-sm ${i === 0 ? "bg-zinc-100 dark:bg-zinc-800" : cellColor(i, 4)}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
