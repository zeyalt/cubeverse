"use client";

import { Star } from "lucide-react";
import { CllCaseCheckDiagram, CllCaseDiagram } from "./CllDiagrams";
import {
  PASS_HOLD_MS,
  SUBCASE_INFO,
  caseProgress,
  globalTarget,
  progressPercent,
  reverseAlgorithm,
  type CllCase,
  type CllTrainerProgress,
} from "@/lib/trainer/cll";

interface CllCaseCardProps {
  cubeCase: CllCase;
  progress: CllTrainerProgress;
  flashing: boolean;
  onPlus: () => void;
  onMinus: () => void;
  onToggleEasy: () => void;
  onTogglePassed: () => void;
  onEditNote: () => void;
}

export function CllCaseCard({
  cubeCase,
  progress,
  flashing,
  onPlus,
  onMinus,
  onToggleEasy,
  onTogglePassed,
  onEditNote,
}: CllCaseCardProps) {
  const entry = caseProgress(progress, cubeCase.id);
  const target = globalTarget(progress);
  const done = entry.count >= target;
  const subcaseInfo = cubeCase.subcase ? SUBCASE_INFO[cubeCase.family]?.[cubeCase.subcase] : undefined;

  return (
    <article
      data-case-id={cubeCase.id}
      className={`surface relative overflow-hidden p-3.5 ${done ? "border-[#009B48]/50" : ""} ${
        entry.passed ? "border-[#009B48]" : ""
      } ${entry.easy && !entry.passed ? "border-[#FFD500]/50" : ""} ${flashing ? "cll-card-flash" : ""}`}
    >
      <PassHoldButton passed={entry.passed} caseId={cubeCase.id} onToggle={onTogglePassed} />

      <div className="flex items-stretch gap-3 pr-9">
        {subcaseInfo && (
          <div className="shrink-0 self-center">
            <CllCaseCheckDiagram cubeCase={cubeCase} info={subcaseInfo} />
          </div>
        )}
        <CllCaseDiagram cubeCase={cubeCase} />
        <div className="grid min-w-0 flex-1 content-start gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-extrabold text-token">{cubeCase.id}</h2>
            <button
              type="button"
              onClick={onToggleEasy}
              aria-pressed={entry.easy}
              className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide [touch-action:manipulation] ${
                entry.easy
                  ? "border-[#FFD500] bg-[#FFD500] text-[#1A1208]"
                  : "border-token text-token-muted"
              }`}
            >
              <Star className={`size-3 ${entry.easy ? "fill-current" : ""}`} />
              Easy
            </button>
          </div>
          <AlgBlock label="Set up" algorithm={reverseAlgorithm(cubeCase.solve)} />
          <AlgBlock
            label="Solve it"
            algorithm={cubeCase.solve}
            note={entry.note}
            onEditNote={onEditNote}
          />
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-strong">
        <div
          className="h-full rounded-full bg-[#FFD500] transition-[width] duration-200"
          style={{ width: `${progressPercent(entry.count, target)}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-token-muted">
          {entry.count} / {target} reps
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onMinus}
            aria-label={`Subtract one practice rep for ${cubeCase.id}`}
            className="btn-neutral min-h-10 min-w-10 px-0 text-lg [touch-action:manipulation]"
          >
            −
          </button>
          <button
            type="button"
            onClick={onPlus}
            aria-label={`Add one practice rep for ${cubeCase.id}`}
            className="btn-accent min-h-10 min-w-10 px-0 text-lg [touch-action:manipulation]"
          >
            +
          </button>
        </div>
      </div>
    </article>
  );
}

function AlgBlock({
  label,
  algorithm,
  note,
  onEditNote,
}: {
  label: string;
  algorithm: string;
  note?: string;
  onEditNote?: () => void;
}) {
  return (
    <div className="rounded-lg bg-surface-strong px-2.5 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-token-muted">{label}</span>
        {onEditNote && (
          <button
            type="button"
            onClick={onEditNote}
            className={`max-w-[55%] truncate rounded-full border px-2 py-0.5 text-[10px] font-bold [touch-action:manipulation] ${
              note
                ? "border-[#0046AD]/40 bg-[#0046AD]/15 text-[#8BB6FF]"
                : "border-dashed border-token text-token-muted"
            }`}
          >
            {note || "+ note"}
          </button>
        )}
      </div>
      <code className="block font-mono text-[13px] font-semibold leading-snug text-token">{algorithm}</code>
    </div>
  );
}

function PassHoldButton({
  passed,
  caseId,
  onToggle,
}: {
  passed: boolean;
  caseId: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      data-pass-hold={caseId}
      title="Press and hold for 2 seconds to toggle pass"
      aria-pressed={passed}
      onPointerDown={(event) => {
        const button = event.currentTarget;
        button.classList.add("holding");
        const timer = window.setTimeout(() => {
          button.classList.remove("holding");
          onToggle();
        }, PASS_HOLD_MS);
        const cancel = () => {
          window.clearTimeout(timer);
          button.classList.remove("holding");
          button.removeEventListener("pointerup", cancel);
          button.removeEventListener("pointerleave", cancel);
          button.removeEventListener("pointercancel", cancel);
        };
        button.addEventListener("pointerup", cancel);
        button.addEventListener("pointerleave", cancel);
        button.addEventListener("pointercancel", cancel);
      }}
      className={`cll-pass-toggle absolute top-3 right-3 z-[2] grid size-8 place-items-center overflow-hidden rounded-full border-2 [touch-action:none] select-none ${
        passed
          ? "border-[#009B48] bg-[#009B48] text-white"
          : "border-token bg-surface text-token-muted"
      }`}
    >
      <span className="relative z-[1] text-sm font-black" aria-hidden>
        ✓
      </span>
    </button>
  );
}
