"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { importWcaResults } from "@/app/actions/import";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Download, Loader2 } from "lucide-react";

function ImportButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Importing…
        </>
      ) : (
        <>
          <Download className="w-4 h-4 mr-2" />
          Import
        </>
      )}
    </Button>
  );
}

export default function ImportPage() {
  const [state, action] = useActionState(importWcaResults, { error: null });

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Import
        </h2>
        <p className="text-zinc-500 text-sm mt-0.5">
          Bring in official WCA results or future practice exports.
        </p>
      </div>

      {/* WCA Import */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
            WCA Import
          </h3>
          <p className="text-sm text-zinc-500 mt-0.5">
            Fetches all official competitions, results, and individual solve
            times. Re-running is safe — existing records are updated, not
            duplicated.
          </p>
        </div>

        <form action={action} className="space-y-3">
          {state.error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          {state.error === null && state.compsImported !== undefined && (
            <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Imported <strong>{state.compsImported}</strong> competition
                {state.compsImported !== 1 ? "s" : ""} and{" "}
                <strong>{state.resultsImported}</strong> new result
                {state.resultsImported !== 1 ? "s" : ""}.
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="wca_id">WCA ID</Label>
            <Input
              id="wca_id"
              name="wca_id"
              placeholder="e.g. 2025ZEYA01"
              defaultValue="2025ZEYA01"
              className="font-mono uppercase"
              autoFocus
            />
          </div>

          <ImportButton />
        </form>
      </div>

      {/* Twisty Timer — coming soon */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 opacity-60">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
            Twisty Timer
          </h3>
          <Badge variant="secondary">Coming soon</Badge>
        </div>
        <p className="text-sm text-zinc-500">
          Import practice solves from a Twisty Timer export file. The parser
          will be built once a sample export is provided.
        </p>
      </div>
    </div>
  );
}
