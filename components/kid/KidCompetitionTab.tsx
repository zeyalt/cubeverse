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
    <div className="space-y-5 px-5 py-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-extrabold text-white">Competitions</h2>
        <p className="text-sm text-white/60">{competitions.length} on the record</p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Link
          href="/parent/competitions/new"
          className="sticker flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-[#0A0A0A] bg-[#009B48] px-4 py-2.5 text-center font-bold text-white transition-transform hover:scale-105 active:scale-95"
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
          className="sticker flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-[#0A0A0A] bg-[#0046AD] px-4 py-2.5 text-center font-bold text-white transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="rounded-xl border-2 border-red-500 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400">
          {error}
        </div>
      )}
      {result && (
        <div className="rounded-xl border-2 border-green-500 bg-green-500/10 px-4 py-3 text-sm font-bold text-green-400">
          ✓ Imported {result.compsImported} competition{result.compsImported !== 1 ? "s" : ""} and{" "}
          {result.resultsImported} new result{result.resultsImported !== 1 ? "s" : ""}
        </div>
      )}

      {/* Competitions list */}
      {competitions.length === 0 ? (
        <div className="rounded-xl bg-white/8 px-6 py-12 text-center">
          <Trophy className="mx-auto size-12 text-white/30 mb-3" />
          <p className="font-display text-lg font-bold text-white/70">No competitions yet</p>
          <p className="mt-1 text-sm text-white/50">Import from WCA or add one manually!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {competitions.map((comp) => (
            <Link
              key={comp.id}
              href={`/competitions/${comp.id}`}
              className="sticker group block rounded-xl border-2 border-white/20 bg-white/8 p-4 transition-all hover:bg-white/12 hover:border-white/30"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 group-hover:bg-white/15">
                  <Trophy className="size-5 text-[#FFD500]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-white truncate">{comp.name}</p>
                    <span
                      className="sticker inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border border-[#0A0A0A]"
                      style={{
                        backgroundColor: comp.type === "wca" ? "#FFD500" : "rgba(255,255,255,0.1)",
                        color: comp.type === "wca" ? "#1A1208" : "rgba(255,255,255,0.7)",
                        boxShadow: "2px 2px 0 rgba(0,0,0,0.1)",
                      }}
                    >
                      {comp.type === "wca" ? "WCA" : "Unofficial"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/60">
                    {(comp.city || comp.country) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {[comp.city, comp.country].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {comp.start_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {comp.start_date}
                        {comp.end_date && comp.end_date !== comp.start_date
                          ? ` – ${comp.end_date}`
                          : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
