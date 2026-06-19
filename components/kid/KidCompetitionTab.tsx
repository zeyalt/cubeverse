"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Trophy, MapPin, Calendar, Plus, Download, Loader2 } from "lucide-react";
import { importWcaResultsKid } from "@/app/actions/import";

interface Competition {
  id: string;
  name: string;
  type: string;
  city: string | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface KidCompetitionTabProps {
  data: {
    competitions: Competition[];
    cuberId: string;
    wcaId: string | null;
  };
}

export function KidCompetitionTab({ data: { competitions, cuberId, wcaId } }: KidCompetitionTabProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ compsImported: number; resultsImported: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-5 px-5 pt-3 pb-6">
      {/* Header */}
      <div>
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-white">Competitions</h2>
        <p className="mt-0.5 text-sm text-white/50">{competitions.length} on the record</p>
      </div>

      {/* Action buttons — one accent primary, one neutral secondary */}
      <div className="flex gap-2">
        <Link
          href="/competitions/new"
          className="btn-accent flex min-h-11 flex-1 items-center justify-center gap-2 px-4 text-center [touch-action:manipulation]"
        >
          <Plus className="size-4" />
          Add
        </Link>
        <button
          onClick={() => {
            if (!wcaId) {
              setError("No WCA ID found. Please set it in your profile.");
              return;
            }
            setError(null);
            setResult(null);
            startTransition(async () => {
              const res = await importWcaResultsKid(cuberId, wcaId);
              if (res.error) {
                setError(res.error);
              } else {
                setResult({ compsImported: res.compsImported || 0, resultsImported: res.resultsImported || 0 });
              }
            });
          }}
          disabled={isPending || !wcaId}
          className="btn-neutral flex min-h-11 flex-1 items-center justify-center gap-2 px-4 text-center [touch-action:manipulation] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Importing…
            </>
          ) : (
            <>
              <Download className="size-4" />
              Import WCA
            </>
          )}
        </button>
      </div>

      {/* Import result messages */}
      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
          {error}
        </div>
      )}
      {result && (
        <div className="rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-300">
          Imported {result.compsImported} competition{result.compsImported !== 1 ? "s" : ""} and{" "}
          {result.resultsImported} new result{result.resultsImported !== 1 ? "s" : ""}
        </div>
      )}

      {/* Competitions list */}
      {competitions.length === 0 ? (
        <div className="surface flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
            <Trophy className="size-7 text-white/40" strokeWidth={1.5} />
          </div>
          <p className="font-display text-lg font-bold text-white">No competitions yet</p>
          <p className="mt-1 max-w-xs text-sm text-white/50">Import from WCA or add one manually to start your record.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {competitions.map((comp) => (
            <Link
              key={comp.id}
              href={`/competitions/${comp.id}`}
              className="surface surface-hover block px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm text-white truncate">{comp.name}</p>
                    <span
                      className="inline-block shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                      style={{
                        backgroundColor: comp.type === "wca" ? "rgba(255,213,0,0.15)" : "rgba(255,255,255,0.08)",
                        color: comp.type === "wca" ? "#FFD500" : "rgba(255,255,255,0.5)",
                      }}
                    >
                      {comp.type === "wca" ? "WCA" : "Unofficial"}
                    </span>
                  </div>
                  {comp.start_date && (
                    <p className="text-[11px] text-white/40 mt-0.5">
                      {comp.start_date}
                      {comp.end_date && comp.end_date !== comp.start_date ? ` – ${comp.end_date}` : ""}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
