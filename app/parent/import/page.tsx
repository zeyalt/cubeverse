"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { importWcaResults } from "@/app/actions/import";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/parent/PageHeader";
import { CheckCircle2, Download, Loader2 } from "lucide-react";

function ImportButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-10">
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Importing…
        </>
      ) : (
        <>
          <Download className="size-4" />
          Import from WCA
        </>
      )}
    </Button>
  );
}

export default function ImportPage() {
  const [state, action] = useActionState(importWcaResults, { error: null });

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader
        title="Import"
        description="Bring in official WCA results or future practice exports."
      />

      <div className="parent-surface p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="font-semibold text-foreground">WCA import</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Fetches competitions, results, and individual solve times. Safe to
            re-run — existing records update in place.
          </p>
        </div>

        <form action={action} className="space-y-4">
          {state.error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {state.error}
            </p>
          )}

          {state.error === null && state.compsImported !== undefined && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
              <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
              <span>
                Imported <strong>{state.compsImported}</strong> competition
                {state.compsImported !== 1 ? "s" : ""} and{" "}
                <strong>{state.resultsImported}</strong> new result
                {state.resultsImported !== 1 ? "s" : ""}.
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="wca_id">WCA ID</Label>
            <Input
              id="wca_id"
              name="wca_id"
              placeholder="e.g. 2025ZEYA01"
              defaultValue="2025ZEYA01"
              className="font-mono-time h-11 uppercase"
              autoFocus
            />
          </div>

          <ImportButton />
        </form>
      </div>

      <div className="parent-surface p-5 sm:p-6 opacity-70">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="font-semibold text-foreground">Twisty Timer</h2>
          <Badge variant="secondary">Coming soon</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Import practice solves from a Twisty Timer export file once a sample
          export is available.
        </p>
      </div>
    </div>
  );
}
