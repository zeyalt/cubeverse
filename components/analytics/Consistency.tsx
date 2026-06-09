"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { ConsistencyPoint } from "@/lib/analytics";
import { formatCs } from "@/lib/cubing";

interface Props { points: ConsistencyPoint[]; window: number }

export function Consistency({ points, window }: Props) {
  const valid = points.filter((p) => p.stdDev !== null);

  if (valid.length < 2) {
    return (
      <div className="h-[200px] flex items-center justify-center text-zinc-400 text-sm">
        Need more solves to compute consistency (rolling window: {window}).
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-zinc-400">
        Rolling standard deviation (window={window}). Lower = more consistent.
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={valid} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="index" tick={{ fontSize: 11 }} label={{ value: "Solve #", position: "insideBottom", offset: -2, fontSize: 11 }} />
          <YAxis tickFormatter={(v: number) => formatCs(v)} tick={{ fontSize: 11 }} width={55} />
          <Tooltip formatter={(v: unknown) => [typeof v === "number" ? formatCs(v) : "—", "Std Dev"]} labelFormatter={(idx) => `Solve #${idx}`} />
          <defs>
            <linearGradient id="consistencyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="stdDev"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#consistencyGradient)"
            dot={false}
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
