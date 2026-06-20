"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { addResultKid, deleteResultKid, deleteCompetition } from "@/app/actions/competition";
import { saveCompetitionNote } from "@/app/actions/notes";
import { formatCs, DNF } from "@/lib/cubing";
import { getEventSticker, EVENT_SHORT } from "@/lib/event-theme";
import { ArrowLeft, Plus, Trash2, MessageSquare } from "lucide-react";
import type { CompetitionNote } from "@/app/actions/notes";

const ROUND_LABELS: Record<string, string> = {
  first: "Round 1",
  second: "Round 2",
  semi: "Semi-Final",
  final: "Final",
};

const ROUND_TYPES = [
  { value: "final", label: "Final" },
  { value: "semi", label: "Semi-Final" },
  { value: "second", label: "Round 2" },
  { value: "first", label: "Round 1" },
];

interface Solve {
  id: string;
  time_cs: number;
  penalty: string;
  position: number;
}

interface Result {
  id: string;
  event_id: string;
  round_type: string;
  format: string;
  best_cs: number | null;
  average_cs: number | null;
  solves: Solve[];
}

interface Competition {
  id: string;
  name: string;
  type: string;
  city: string | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
  cuber_id?: string;
}

interface Event {
  id: string;
  name: string;
  format: string;
}

interface KidCompetitionDetailProps {
  competition: Competition;
  results: Result[];
  events: Event[];
  cuberId: string;
  notes: CompetitionNote[];
}

function SolveChip({ timeCs, penalty }: { timeCs: number; penalty: string }) {
  let display = "";
  if (penalty === "dnf") {
    display = "DNF";
  } else if (penalty === "dns") {
    display = "DNS";
  } else if (penalty === "plus2") {
    display = formatCs(timeCs + 200) + "+";
  } else {
    display = formatCs(timeCs);
  }
  return (
    <span className="font-mono-time rounded-md bg-white/10 px-2 py-1 text-xs font-bold text-white">
      {display}
    </span>
  );
}

function ResultCard({
  result,
  events,
  competitionId,
  competitionType,
  cuberId,
  expandedNotes,
  noteTexts,
  onToggleNote,
  onSaveNote,
  onUpdateNoteText,
}: {
  result: Result;
  events: Event[];
  competitionId: string;
  competitionType: string;
  cuberId: string;
  expandedNotes: Set<string>;
  noteTexts: Record<string, string>;
  onToggleNote: (key: string) => void;
  onSaveNote: (cuberId: string, competitionId: string, eventId: string, roundType: string, content: string) => Promise<void>;
  onUpdateNoteText: (key: string, text: string) => void;
}) {
  const event = events.find((e) => e.id === result.event_id);
  const sticker = getEventSticker(result.event_id);
  const noteKey = `${result.event_id}-${result.round_type}`;
  const isExpanded = expandedNotes.has(noteKey);
  const noteContent = noteTexts[noteKey] || "";
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(noteContent);
  const [isSaving, setIsSaving] = useState(false);

  return (
    <div className="sticker rounded-xl border-2 border-white/10 bg-white/8 px-4 py-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="size-8 shrink-0 flex items-center justify-center rounded-lg font-bold text-xs"
            style={{ backgroundColor: sticker.face, color: sticker.ink }}
          >
            {EVENT_SHORT[result.event_id] ?? result.event_id}
          </div>
          <div>
            <p className="font-bold text-white">{event?.name ?? result.event_id}</p>
            <p className="text-[10px] text-white/60">{ROUND_LABELS[result.round_type] ?? result.round_type}</p>
          </div>
        </div>
        {competitionType !== "wca" && (
          <form action={deleteResultKid} className="shrink-0">
            <input type="hidden" name="result_id" value={result.id} />
            <input type="hidden" name="competition_id" value={competitionId} />
            <button
              type="submit"
              className="flex size-8 items-center justify-center rounded-lg bg-red-500/20 text-red-400 transition-colors hover:bg-red-500/30"
              title="Delete result"
            >
              <Trash2 className="size-4" />
            </button>
          </form>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-white/60">Best</span>
          <span className="font-mono-time text-lg font-bold text-white">
            {result.best_cs === null ? "—" : result.best_cs === DNF ? "DNF" : formatCs(result.best_cs)}
          </span>
        </div>
        {result.average_cs !== null && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-white/60">Avg</span>
            <span className="font-mono-time text-lg font-bold text-white">
              {formatCs(result.average_cs)}
            </span>
          </div>
        )}
        {result.solves.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {result.solves.map((solve) => (
              <SolveChip key={solve.id} timeCs={solve.time_cs} penalty={solve.penalty} />
            ))}
          </div>
        )}

        {/* Reflections Section */}
        <button
          onClick={() => {
            if (!isExpanded) setDraftText(noteContent);
            onToggleNote(noteKey);
          }}
          className="mt-3 w-full flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs font-bold text-white/70 transition-colors hover:bg-white/10"
        >
          <span className="flex items-center gap-2">
            <MessageSquare className="size-4" />
            Reflections
          </span>
          <span>{isExpanded ? "−" : "+"}</span>
        </button>

        {isExpanded && (
          <div className="space-y-2">
            {isEditing ? (
              <>
                <textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  placeholder="Write your reflections here..."
                  autoFocus
                  className="w-full rounded-lg bg-white/10 border border-white/30 px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FFD500]/60 resize-none"
                  rows={4}
                />
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setIsSaving(true);
                      onUpdateNoteText(noteKey, draftText);
                      await onSaveNote(cuberId, competitionId, result.event_id, result.round_type, draftText);
                      setIsSaving(false);
                      setIsEditing(false);
                    }}
                    disabled={isSaving}
                    className="flex-1 rounded-lg bg-[#009B48] py-2 text-xs font-bold text-white transition-colors hover:bg-[#007a3a] disabled:opacity-50"
                  >
                    {isSaving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setDraftText(noteContent);
                      setIsEditing(false);
                    }}
                    className="flex-1 rounded-lg bg-white/10 py-2 text-xs font-bold text-white/70 transition-colors hover:bg-white/15"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                {noteContent ? (
                  <p className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80 whitespace-pre-wrap leading-relaxed">
                    {noteContent}
                  </p>
                ) : (
                  <p className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/30 italic">
                    No reflections yet.
                  </p>
                )}
                <button
                  onClick={() => {
                    setDraftText(noteContent);
                    setIsEditing(true);
                  }}
                  className="w-full rounded-lg bg-white/8 py-2 text-xs font-bold text-white/60 transition-colors hover:bg-white/12"
                >
                  {noteContent ? "Edit" : "Add reflection"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="sticker w-full rounded-xl border-2 border-[#0A0A0A] bg-[#009B48] px-4 py-2.5 text-center font-bold text-white transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save result"}
    </button>
  );
}

function AddResultSheet({
  competitionId,
  events,
  onClose,
}: {
  competitionId: string;
  events: Event[];
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(addResultKid, { error: null });
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id ?? "333");
  const [roundType, setRoundType] = useState("final");
  const [solves, setSolves] = useState<Array<{ timeStr: string; penalty: string }>>(
    Array(5).fill(null).map(() => ({ timeStr: "", penalty: "none" }))
  );

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const solveSlots = selectedEvent?.format === "mo3" ? 3 : selectedEvent?.format === "bo1" ? 1 : selectedEvent?.format === "bo3" ? 3 : 5;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="sheet-enter fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl border-t-2 border-white/10 bg-[#1C1916] px-5 pt-4"
        style={{
          paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <h3 className="font-display mb-4 text-xl font-bold text-white">Add result</h3>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="competition_id" value={competitionId} />
          <input type="hidden" name="event_id" value={selectedEventId} />
          <input type="hidden" name="round_type" value={roundType} />

          {/* Event selector */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/60">Event</p>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
              {events.map((ev) => {
                const s = getEventSticker(ev.id);
                const active = ev.id === selectedEventId;
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => setSelectedEventId(ev.id)}
                    className="event-sticker shrink-0 rounded-xl border-2 border-[#0A0A0A] px-4 py-2 text-sm font-bold transition-transform active:scale-95"
                    style={{
                      backgroundColor: active ? s.face : "rgba(255,255,255,0.1)",
                      color: active ? s.ink : "rgba(255,255,255,0.7)",
                      boxShadow: active ? `3px 3px 0 #0A0A0A` : "none",
                    }}
                  >
                    {EVENT_SHORT[ev.id] ?? ev.id}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Round type */}
          <div>
            <label htmlFor="round" className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-2">
              Round
            </label>
            <select
              id="round"
              value={roundType}
              onChange={(e) => setRoundType(e.target.value)}
              className="w-full rounded-xl border-2 border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors focus:border-white/40 focus:outline-none"
            >
              {ROUND_TYPES.map((r) => (
                <option key={r.value} value={r.value} className="bg-[#1C1916]">
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Solve inputs */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/60">Times</p>
            <div className="space-y-2">
              {solves.slice(0, solveSlots).map((solve, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    placeholder={i === 0 ? "e.g. 12.34" : ""}
                    value={solve.timeStr}
                    onChange={(e) => {
                      const newSolves = [...solves];
                      newSolves[i].timeStr = e.target.value;
                      setSolves(newSolves);
                    }}
                    name={`time_${i + 1}`}
                    className="flex-1 rounded-lg border-2 border-white/20 bg-white/10 px-2.5 py-2 text-sm font-mono-time text-white placeholder-white/40 transition-colors focus:border-white/40 focus:outline-none"
                  />
                  <select
                    value={solve.penalty}
                    onChange={(e) => {
                      const newSolves = [...solves];
                      newSolves[i].penalty = e.target.value;
                      setSolves(newSolves);
                    }}
                    name={`penalty_${i + 1}`}
                    className="rounded-lg border-2 border-white/20 bg-white/10 px-2.5 py-2 text-xs font-bold text-white transition-colors focus:border-white/40 focus:outline-none"
                  >
                    <option value="none" className="bg-[#1C1916]">OK</option>
                    <option value="plus2" className="bg-[#1C1916]">+2</option>
                    <option value="dnf" className="bg-[#1C1916]">DNF</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {state.error && (
            <p className="rounded-lg border-2 border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {state.error}
            </p>
          )}

          <SubmitButton />
        </form>

        <button
          onClick={onClose}
          className="mt-3 rounded-lg bg-white/5 px-4 py-2 text-center text-xs font-medium text-white/60 transition-colors hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </>
  );
}

export function KidCompetitionDetail({
  competition,
  results,
  events,
  cuberId,
  notes,
}: KidCompetitionDetailProps) {
  const router = useRouter();
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [noteTexts, setNoteTexts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    notes.forEach((note) => {
      const key = `${note.eventId}-${note.roundType}`;
      map[key] = note.content || "";
    });
    return map;
  });

  return (
    <div className="kid-canvas min-h-screen flex flex-col text-white">
      {/* Header */}
      <header className="relative z-10 flex items-center gap-3 px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4">
        <button
          onClick={() => router.back()}
          className="sticker-ghost flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 transition-transform active:scale-95"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl font-extrabold truncate">{competition.name}</h1>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            {(competition.city || competition.country) && (
              <p className="text-xs text-white/50">
                {[competition.city, competition.country].filter(Boolean).join(", ")}
              </p>
            )}
            {competition.start_date && (
              <p className="text-xs text-white/50">{competition.start_date}</p>
            )}
            <span
              className="sticker inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border border-[#0A0A0A]"
              style={{
                backgroundColor: competition.type === "wca" ? "#FFD500" : "rgba(255,255,255,0.1)",
                color: competition.type === "wca" ? "#1A1208" : "rgba(255,255,255,0.7)",
                boxShadow: "2px 2px 0 rgba(0,0,0,0.1)",
              }}
            >
              {competition.type === "wca" ? "WCA" : "Non-WCA"}
            </span>
          </div>
        </div>
        {competition.type !== "wca" && (
          <form
            action={deleteCompetition}
            className="shrink-0"
            onSubmit={(e) => {
              if (!window.confirm(`Delete "${competition.name}"? This removes all its results and can't be undone.`)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="competition_id" value={competition.id} />
            <button
              type="submit"
              className="sticker-ghost flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-500/20 text-red-400 transition-transform active:scale-95"
              title="Delete competition"
              aria-label="Delete competition"
            >
              <Trash2 className="size-5" />
            </button>
          </form>
        )}
      </header>

      {/* Results list */}
      <main className="flex-1 px-5 py-4 space-y-3" style={{ paddingBottom: "calc(1.5rem + 4.5rem + env(safe-area-inset-bottom))" }}>
        {results.length === 0 ? (
          <div className="rounded-xl bg-white/8 px-6 py-12 text-center">
            <p className="text-lg text-white/50">No results yet</p>
            <p className="mt-1 text-xs text-white/40">Tap + to add your first result</p>
          </div>
        ) : (
          results.map((result) => (
            <ResultCard
              key={result.id}
              result={result}
              events={events}
              competitionId={competition.id}
              competitionType={competition.type}
              cuberId={cuberId}
              expandedNotes={expandedNotes}
              noteTexts={noteTexts}
              onToggleNote={(key) => {
                const newExpanded = new Set(expandedNotes);
                if (newExpanded.has(key)) {
                  newExpanded.delete(key);
                } else {
                  newExpanded.add(key);
                }
                setExpandedNotes(newExpanded);
              }}
              onUpdateNoteText={(key, text) => {
                setNoteTexts({ ...noteTexts, [key]: text });
              }}
              onSaveNote={(cuberId, competitionId, eventId, roundType, content) =>
                saveCompetitionNote(cuberId, competitionId, eventId, roundType, content).then(() => {})
              }
            />
          ))
        )}
      </main>

      {/* Floating + button */}
      <button
        onClick={() => setShowAddForm(true)}
        className="sticker fixed z-30 flex size-14 items-center justify-center rounded-2xl border-2 border-[#0A0A0A] bg-[#009B48] text-white transition-transform hover:scale-110 active:scale-95"
        style={{
          right: "1.25rem",
          bottom: "calc(1.5rem + 4.5rem + env(safe-area-inset-bottom))",
          boxShadow: "4px 4px 0 #0A0A0A",
        }}
      >
        <Plus className="size-7" />
      </button>

      {/* Add result sheet */}
      {showAddForm && (
        <AddResultSheet
          competitionId={competition.id}
          events={events}
          onClose={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
}

import React from "react";
