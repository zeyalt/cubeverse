"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteSolveFromHistory, type SolveRow } from "@/app/actions/solve-history";
import { formatCs } from "@/lib/cubing";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  solves: SolveRow[];
  eventId: string;
}

function DeleteButton({ solveId, eventId }: { solveId: string; eventId: string }) {
  const [state, action] = useActionState(deleteSolveFromHistory, { error: null });
  const { pending } = useFormStatus();

  return (
    <form action={action} onSubmit={(e) => {
      if (!confirm("Delete this solve? This cannot be undone.")) {
        e.preventDefault();
      }
    }}>
      <input type="hidden" name="solve_id" value={solveId} />
      <input type="hidden" name="event_id" value={eventId} />
      <button
        type="submit"
        disabled={pending}
        className="text-zinc-300 hover:text-red-500 transition-colors disabled:opacity-50 p-1"
        title="Delete solve"
      >
        <Trash2 className="w-4 h-4" />
      </button>
      {state.error && (
        <p className="text-xs text-red-600 mt-1">{state.error}</p>
      )}
    </form>
  );
}

function SolveRow({ solve, eventId }: { solve: SolveRow; eventId: string }) {
  const [expanded, setExpanded] = useState(false);

  const timeStr = solve.penalty === "dnf" ? "DNF" :
                   solve.penalty === "dns" ? "DNS" :
                   solve.penalty === "plus2" ? formatCs(solve.time_cs + 200) + "+" :
                   formatCs(solve.time_cs);

  const dateObj = new Date(solve.solved_at);

  const timeStr2 = dateObj.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const sessionDateStr = dateObj.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
  // dateStr is used in the template below

  return (
    <>
      <tr className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
        <td className="px-4 py-3 font-mono font-semibold text-zinc-900 dark:text-zinc-50">
          {timeStr}
        </td>
        <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
          {solve.penalty === "none" ? "OK" :
           solve.penalty === "plus2" ? "+2" :
           solve.penalty === "dnf" ? "DNF" : "DNS"}
        </td>
        <td className="px-4 py-3 text-sm text-zinc-500">
          {sessionDateStr}
          <br />
          <span className="text-xs text-zinc-400">{timeStr2}</span>
        </td>
        <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 max-w-xs">
          {solve.scramble ? (
            <span className="truncate block">{solve.scramble}</span>
          ) : (
            <span className="text-zinc-400 italic">No scramble</span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-1"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </td>
        <td className="px-4 py-3 text-right">
          <DeleteButton solveId={solve.id} eventId={eventId} />
        </td>
      </tr>
      {expanded && (
        <tr className="bg-zinc-50 dark:bg-zinc-900/30 border-b border-zinc-100 dark:border-zinc-800">
          <td colSpan={6} className="px-4 py-3">
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-zinc-400 text-xs uppercase tracking-wider">Full scramble</p>
                <p className="font-mono text-zinc-700 dark:text-zinc-300 break-words">
                  {solve.scramble || "No scramble recorded"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-zinc-400 text-xs uppercase tracking-wider">Solved at</p>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    {dateObj.toLocaleString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-400 text-xs uppercase tracking-wider">Solve ID</p>
                  <p className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {solve.id.slice(0, 8)}...
                  </p>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function SolveHistoryTable({ solves, eventId }: Props) {
  if (!solves.length) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 py-12 text-center text-zinc-400">
        <p className="text-sm">No solves yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
              Time
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
              Penalty
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
              Date & Time
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
              Scramble
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
              Details
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {solves.map((solve) => (
            <SolveRow key={solve.id} solve={solve} eventId={eventId} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
