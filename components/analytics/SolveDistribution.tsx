"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { DistBin } from "@/lib/analytics";

interface Props { bins: DistBin[] }

export function SolveDistribution({ bins }: Props) {
  if (!bins.length) {
    return (
      <div className="h-[200px] flex items-center justify-center text-zinc-400 text-sm">
        Not enough solves yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={bins} margin={{ top: 8, right: 8, left: 0, bottom: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10 }}
          interval={Math.max(0, Math.floor(bins.length / 10) - 1)}
          angle={-30}
          textAnchor="end"
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="count" name="Solves" fill="#6366f1" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
