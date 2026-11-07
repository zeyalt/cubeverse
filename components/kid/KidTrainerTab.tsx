"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Settings, Sparkles, X } from "lucide-react";
import { EventIcon } from "@/components/kid/EventIcon";
import { CllCaseCard } from "@/components/trainer/CllCaseCard";
import { CllSubcaseDiagram } from "@/components/trainer/CllDiagrams";
import { saveTrainerProgress } from "@/lib/client/actions";
import { getClientTabData } from "@/lib/client/tabData";
import {
  CLL_FAMILIES,
  CLL_TRAINER_KEY,
  NOTE_MAX_LENGTH,
  SUBCASE_INFO,
  SUBCASE_ORDER,
  caseProgress,
  familyUsesOppositeCorners,
  filteredCases,
  globalTarget,
  pickPractisedCase,
  progressPercent,
  rememberProgress,
  rememberedProgress,
  resetProgress,
  withCasePatch,
  type CllTrainerProgress,
} from "@/lib/trainer/cll";
import type { TrainerTabData } from "@/lib/kid/tabData";

const SAVE_DEBOUNCE_MS = 400;

interface KidTrainerTabProps {
  data: TrainerTabData;
}

export function KidTrainerTab({ data }: KidTrainerTabProps) {
  const [progress, setProgress] = useState(
    () => rememberedProgress(data.cuberId) ?? data.progress
  );
  const [activeFamily, setActiveFamily] = useState("Antisune");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [onlyEasy, setOnlyEasy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [noteCaseId, setNoteCaseId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [flashId, setFlashId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const progressRef = useRef(progress);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveGen = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (rememberedProgress(data.cuberId)) return;
    let cancelled = false;
    void getClientTabData("trainer", data.cuberId, "222").then((result) => {
      if (cancelled || result.tab !== "trainer" || saveTimer.current) return;
      if (rememberedProgress(data.cuberId)) return;
      progressRef.current = result.data.progress;
      rememberProgress(data.cuberId, result.data.progress);
      setProgress(result.data.progress);
    });
    return () => {
      cancelled = true;
    };
  }, [data.cuberId]);

  const flushSave = useCallback(
    async (next: CllTrainerProgress) => {
      const gen = ++saveGen.current;
      rememberProgress(data.cuberId, next);
      const result = await saveTrainerProgress(data.cuberId, CLL_TRAINER_KEY, next);
      if (gen !== saveGen.current) return;
      setSaveError(result.error);
    },
    [data.cuberId]
  );

  const scheduleSave = useCallback(
    (next: CllTrainerProgress) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        void flushSave(next);
      }, SAVE_DEBOUNCE_MS);
    },
    [flushSave]
  );

  const commit = useCallback(
    (updater: (current: CllTrainerProgress) => CllTrainerProgress) => {
      setProgress((current) => {
        const next = updater(current);
        progressRef.current = next;
        rememberProgress(data.cuberId, next);
        scheduleSave(next);
        return next;
      });
    },
    [data.cuberId, scheduleSave]
  );

  useEffect(() => {
    if (!flashId) return;
    document.querySelector(`[data-case-id="${flashId}"]`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [flashId, activeFamily]);

  useEffect(() => {
    const flushNow = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        void flushSave(progressRef.current);
      }
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    window.addEventListener("pagehide", flushNow);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flushNow);
      document.removeEventListener("visibilitychange", onHide);
      flushNow();
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, [flushSave]);

  const target = globalTarget(progress);
  const passed = Object.values(progress.cases).filter((entry) => entry.passed).length;
  const total = Object.keys(progress.cases).length;
  const remaining = total - passed;
  const visible = filteredCases(progress, activeFamily, onlyIncomplete, onlyEasy);
  const groupOrder = SUBCASE_ORDER[activeFamily as keyof typeof SUBCASE_ORDER];
  const groupBySubcase = Boolean(groupOrder) && visible.every((item) => item.subcase);

  function surpriseSpin() {
    const pool = filteredCases(progress, "all", false, false).filter(
      (cubeCase) => progress.spinFamilies[cubeCase.family] !== false
    );
    const pick = pickPractisedCase(pool, progress);
    if (!pick) return;
    if (activeFamily !== "all" && pick.family !== activeFamily) {
      setActiveFamily(pick.family);
    }
    setFlashId(pick.id);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 1200);
  }

  function openNote(id: string) {
    setNoteCaseId(id);
    setNoteDraft(caseProgress(progress, id).note);
  }

  function saveNote() {
    if (!noteCaseId) return;
    commit((current) =>
      withCasePatch(current, noteCaseId, { note: noteDraft.trim().slice(0, NOTE_MAX_LENGTH) })
    );
    setNoteCaseId(null);
  }

  return (
    <div className="px-3 pt-2 pb-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-token-muted">
            <EventIcon event="222" className="text-sm" />
            2×2 cube
          </p>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-token">CLL Trainer</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="btn-neutral inline-flex min-h-11 items-center gap-1.5 px-3 text-sm [touch-action:manipulation]"
          >
            <Settings className="size-4" />
            Settings
          </button>
          <button
            type="button"
            onClick={surpriseSpin}
            className="btn-accent inline-flex min-h-11 items-center gap-1.5 px-3 text-sm [touch-action:manipulation]"
          >
            <Sparkles className="size-4" />
            Surprise spin
          </button>
        </div>
      </div>

      <section className="mb-4 grid grid-cols-3 gap-2" aria-label="Practice overview">
        <Metric value={String(passed)} label="algs certified pass" />
        <Metric value={`${progressPercent(passed, total)}%`} label="% certified pass" />
        <Metric value={String(remaining)} label="algs left to certify" />
        <div className="col-span-3 h-2 overflow-hidden rounded-full bg-surface-strong">
          <div
            className="h-full rounded-full bg-[#FFD500] transition-[width] duration-200"
            style={{ width: `${progressPercent(passed, total)}%` }}
          />
        </div>
      </section>

      {saveError && (
        <p className="mb-3 rounded-lg border border-[#B71234]/40 bg-[#B71234]/15 px-3 py-2 text-sm text-[#FF8A9A]">
          Could not sync progress: {saveError}
        </p>
      )}

      <section className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-label="Filters">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Case family">
          {[...CLL_FAMILIES, "all" as const].map((family) => {
            const active = family === activeFamily;
            return (
              <button
                key={family}
                type="button"
                onClick={() => setActiveFamily(family)}
                // The selected family was shown by colour alone.
                aria-pressed={active}
                className={`min-h-10 min-w-9 rounded-full px-2.5 text-xs font-bold [touch-action:manipulation] ${
                  active ? "btn-accent" : "btn-neutral"
                }`}
              >
                {family === "all" ? "All" : family}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <label className="flex min-h-9 items-center gap-2 text-sm font-semibold text-token">
            <input
              type="checkbox"
              checked={onlyEasy}
              onChange={(event) => setOnlyEasy(event.target.checked)}
              className="size-4 accent-[#FFD500]"
            />
            Only easy
          </label>
          <label className="flex min-h-9 items-center gap-2 text-sm font-semibold text-token">
            <input
              type="checkbox"
              checked={onlyIncomplete}
              onChange={(event) => setOnlyIncomplete(event.target.checked)}
              className="size-4 accent-[#FFD500]"
            />
            Only unfinished
          </label>
        </div>
      </section>

      <section className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-token-muted" aria-label="Diagram legend">
        {familyUsesOppositeCorners(activeFamily) && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-[3px] border border-[#FFD500] bg-[#FFD500]" />
            = where the opposite colours are
          </span>
        )}
        <span>
          <strong className="text-token">O</strong> = opposite colours
        </span>
        <span>
          <strong className="text-token">S</strong> = same colours
        </span>
        <span>
          <strong className="text-token">D</strong> = different colours
        </span>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-live="polite">
        {visible.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-token-muted">
            No cases match the current filters.
          </p>
        )}
        {groupBySubcase &&
          groupOrder!.map((subcase) => {
            const group = visible.filter((item) => item.subcase === subcase);
            if (!group.length) return null;
            const info = SUBCASE_INFO[activeFamily as keyof typeof SUBCASE_INFO]?.[subcase];
            return (
              <div key={subcase} className="col-span-full contents">
                {info && (
                  <div className="col-span-full flex items-center gap-3 pt-2 first:pt-0">
                    <CllSubcaseDiagram info={info} />
                    <h2 className="font-display text-base font-bold text-token">{info.title}</h2>
                  </div>
                )}
                {group.map((cubeCase) => (
                  <CllCaseCard
                    key={cubeCase.id}
                    cubeCase={cubeCase}
                    progress={progress}
                    flashing={flashId === cubeCase.id}
                    onPlus={() =>
                      commit((current) =>
                        withCasePatch(current, cubeCase.id, {
                          count: caseProgress(current, cubeCase.id).count + 1,
                        })
                      )
                    }
                    onMinus={() =>
                      commit((current) =>
                        withCasePatch(current, cubeCase.id, {
                          count: Math.max(0, caseProgress(current, cubeCase.id).count - 1),
                        })
                      )
                    }
                    onToggleEasy={() =>
                      commit((current) =>
                        withCasePatch(current, cubeCase.id, {
                          easy: !caseProgress(current, cubeCase.id).easy,
                        })
                      )
                    }
                    onTogglePassed={() =>
                      commit((current) =>
                        withCasePatch(current, cubeCase.id, {
                          passed: !caseProgress(current, cubeCase.id).passed,
                        })
                      )
                    }
                    onEditNote={() => openNote(cubeCase.id)}
                  />
                ))}
              </div>
            );
          })}
        {!groupBySubcase &&
          visible.map((cubeCase) => (
            <CllCaseCard
              key={cubeCase.id}
              cubeCase={cubeCase}
              progress={progress}
              flashing={flashId === cubeCase.id}
              onPlus={() =>
                commit((current) =>
                  withCasePatch(current, cubeCase.id, {
                    count: caseProgress(current, cubeCase.id).count + 1,
                  })
                )
              }
              onMinus={() =>
                commit((current) =>
                  withCasePatch(current, cubeCase.id, {
                    count: Math.max(0, caseProgress(current, cubeCase.id).count - 1),
                  })
                )
              }
              onToggleEasy={() =>
                commit((current) =>
                  withCasePatch(current, cubeCase.id, {
                    easy: !caseProgress(current, cubeCase.id).easy,
                  })
                )
              }
              onTogglePassed={() =>
                commit((current) =>
                  withCasePatch(current, cubeCase.id, {
                    passed: !caseProgress(current, cubeCase.id).passed,
                  })
                )
              }
              onEditNote={() => openNote(cubeCase.id)}
            />
          ))}
      </section>

      {settingsOpen && (
        <SettingsSheet
          progress={progress}
          target={target}
          onClose={() => setSettingsOpen(false)}
          onTarget={(value) => commit((current) => ({ ...current, globalTarget: value }))}
          onSpinFamily={(family, enabled) =>
            commit((current) => ({
              ...current,
              spinFamilies: { ...current.spinFamilies, [family]: enabled },
            }))
          }
          onReset={() => commit(resetProgress)}
        />
      )}

      {noteCaseId && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md" onClick={() => setNoteCaseId(null)} />
          <form
            className="surface fixed top-1/2 left-1/2 z-[101] w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              saveNote();
            }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-token-muted">Memory aid</p>
                <h2 className="font-display text-xl font-bold text-token">{noteCaseId} note</h2>
              </div>
              <button
                type="button"
                onClick={() => setNoteCaseId(null)}
                className="flex size-8 items-center justify-center rounded-lg bg-surface-strong"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>
            <label className="grid gap-1.5 text-xs font-bold text-token-muted">
              Note (max {NOTE_MAX_LENGTH} characters)
              <input
                value={noteDraft}
                maxLength={NOTE_MAX_LENGTH}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="e.g. right sledgehammer"
                autoFocus
                className="min-h-11 rounded-lg border border-token bg-surface px-3 text-sm font-semibold text-token placeholder:text-token-muted focus:border-token-strong focus:outline-none"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setNoteCaseId(null)} className="btn-neutral min-h-11 px-4">
                Cancel
              </button>
              <button type="submit" className="btn-accent min-h-11 px-4">
                Save
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="surface px-3 py-3">
      <span className="block font-display text-2xl font-extrabold text-[#FFD500]">{value}</span>
      <small className="mt-1 block text-[11px] font-semibold text-token-muted">{label}</small>
    </div>
  );
}

function SettingsSheet({
  progress,
  target,
  onClose,
  onTarget,
  onSpinFamily,
  onReset,
}: {
  progress: CllTrainerProgress;
  target: number;
  onClose: () => void;
  onTarget: (value: number) => void;
  onSpinFamily: (family: string, enabled: boolean) => void;
  onReset: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartY = useRef(0);

  function onDragStart(clientY: number) {
    dragStartY.current = clientY;
    setDragging(true);
  }
  function onDragMove(clientY: number) {
    if (!dragging) return;
    const delta = clientY - dragStartY.current;
    if (delta > 0) setDragY(delta);
  }
  function onDragEnd() {
    if (!dragging) return;
    setDragging(false);
    if (dragY > 120) onClose();
    else setDragY(0);
  }

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div
        className={`${dragging ? "" : "sheet-enter"} bg-sheet fixed right-0 bottom-0 left-0 z-[101] flex max-h-[85vh] flex-col overflow-y-auto rounded-t-3xl border-t-2 border-token px-5 pt-2`}
        style={{
          paddingBottom: "calc(2rem + env(safe-area-inset-bottom))",
          transform: `translateY(${dragY}px)`,
          transition: dragging ? "none" : "transform 0.25s ease",
        }}
      >
        <div
          className="-mx-5 cursor-grab touch-none px-5 pt-2 pb-2 active:cursor-grabbing"
          style={{ touchAction: "none" }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            onDragStart(event.clientY);
          }}
          onPointerMove={(event) => onDragMove(event.clientY)}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <div className="mx-auto h-1.5 w-12 rounded-full bg-white/25" />
        </div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-token-muted">Settings</p>
            <h2 className="font-display text-xl font-bold text-token">Global target</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg bg-surface-strong"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <label className="grid gap-1.5 text-xs font-bold text-token-muted">
          Target reps for every case
          <input
            type="number"
            min={1}
            max={200}
            step={1}
            value={target}
            onChange={(event) => onTarget(Math.max(1, Math.min(200, Number(event.target.value) || 1)))}
            className="min-h-11 rounded-lg border border-token bg-surface px-3 text-sm font-semibold text-token focus:border-token-strong focus:outline-none"
          />
        </label>
        <div className="mt-5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-token-muted">
            Eligible for surprise spin
          </p>
          <div className="grid grid-cols-2 gap-2">
            {CLL_FAMILIES.map((family) => (
              <label key={family} className="flex min-h-11 items-center gap-2 text-sm font-semibold text-token">
                <input
                  type="checkbox"
                  checked={progress.spinFamilies[family] !== false}
                  onChange={(event) => onSpinFamily(family, event.target.checked)}
                  className="size-4 accent-[#FFD500]"
                />
                {family}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-6">
          {confirmReset ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-token">Reset counts, notes, passes, and easy marks?</p>
              <button type="button" onClick={() => setConfirmReset(false)} className="btn-neutral min-h-11 px-4">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onReset();
                  setConfirmReset(false);
                  onClose();
                }}
                className="min-h-11 rounded-xl bg-[#B71234] px-4 font-bold text-white"
              >
                Reset
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="min-h-11 rounded-xl border border-[#B71234]/40 px-4 font-semibold text-[#FF8A9A]"
            >
              Reset progress
            </button>
          )}
        </div>
      </div>
    </>
  );
}
