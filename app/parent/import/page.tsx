import { Badge } from "@/components/ui/badge";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-1">
          Import
        </h2>
        <p className="text-zinc-500 text-sm">
          Bring in your official WCA results or practice data.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 bg-white dark:bg-zinc-900">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
            WCA Import
          </h3>
          <p className="text-sm text-zinc-500">
            Fetch all official results by WCA ID — coming in Phase 8.
          </p>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 bg-white dark:bg-zinc-900 opacity-60">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
              Twisty Timer
            </h3>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-zinc-500">
            Import practice solves from a Twisty Timer export file.
          </p>
        </div>
      </div>
    </div>
  );
}
