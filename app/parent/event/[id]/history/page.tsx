import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { fetchSolveHistory, getSolveCount } from "@/app/actions/solve-history";
import { SolveHistoryTable } from "@/components/parent/SolveHistoryTable";

const ACTIVE_EVENTS: Record<string, string> = {
  "333": "3×3×3 Cube",
  "222": "2×2×2 Cube",
  pyram: "Pyraminx",
  skewb: "Skewb",
  clock: "Clock",
  "444": "4×4×4 Cube",
  "333oh": "3×3×3 One-Handed",
};

export default async function SolveHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id: eventId } = await params;
  const { page = "1" } = await searchParams;
  const pageNum = Math.max(1, parseInt(page) || 1);

  if (!ACTIVE_EVENTS[eventId]) notFound();

  const pageSize = 50;
  const offset = (pageNum - 1) * pageSize;

  const [solves, totalCount] = await Promise.all([
    fetchSolveHistory(eventId, pageSize, offset),
    getSolveCount(eventId),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <Link
          href={`/parent/event/${eventId}`}
          className="p-1.5 -m-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Practice History
          </h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {ACTIVE_EVENTS[eventId]} — {totalCount} solve{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Solves table */}
      <SolveHistoryTable solves={solves} eventId={eventId} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            Page {pageNum} of {totalPages}
          </p>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <Link
                href={`?page=${pageNum - 1}`}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                ← Previous
              </Link>
            )}
            {pageNum < totalPages && (
              <Link
                href={`?page=${pageNum + 1}`}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
