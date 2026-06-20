"use client";

import { useState, useRef } from "react";
import { X, Moon, Sun, Upload, Loader2, Check, ChevronDown, Trash2 } from "lucide-react";
import { importTwistyTimerData, clearImportedSolves } from "@/app/actions/import";
import { useTheme } from "@/lib/useTheme";

const EVENTS = [
  { id: "333", label: "3×3×3" },
  { id: "222", label: "2×2×2" },
  { id: "444", label: "4×4×4" },
  { id: "555", label: "5×5×5" },
  { id: "pyram", label: "Pyraminx" },
  { id: "skewb", label: "Skewb" },
  { id: "clock", label: "Clock" },
  { id: "333oh", label: "3×3 OH" },
];

interface SettingsSheetProps {
  onClose: () => void;
  cuberId: string;
}

export function SettingsSheet({ onClose, cuberId }: SettingsSheetProps) {
  const { theme, setTheme } = useTheme();

  // Import state
  const [importEventId, setImportEventId] = useState("333");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ solvesImported: number; solvesParsed: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear imported solves state
  const [clearEventId, setClearEventId] = useState<string>("all");
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<{ deletedCount: number } | null>(null);
  const [clearError, setClearError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    setImportError(null);
    setImporting(true);
    try {
      const text = await file.text();
      const result = await importTwistyTimerData(cuberId, importEventId, text);
      if (result.error) {
        setImportError(result.error);
      } else {
        setImportResult({ solvesImported: result.solvesImported ?? 0, solvesParsed: result.solvesParsed ?? 0 });
      }
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  const selectClass =
    "w-full appearance-none rounded-lg border border-token bg-surface px-3 py-2 text-sm font-semibold text-token focus:outline-none focus:border-token-strong";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none">
        <div
          className="settings-sheet bg-sheet rounded-2xl border border-token w-full max-w-sm pointer-events-auto flex max-h-[85dvh] flex-col"
          style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.45)" }}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between px-5 pt-5 pb-3">
            <h2 className="font-display text-lg font-bold text-token">Settings</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex size-8 items-center justify-center rounded-lg bg-surface text-token transition-colors hover:bg-surface-strong [touch-action:manipulation]"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 space-y-5">
            {/* Theme */}
            <section className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-token-muted">Appearance</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setTheme("dark")}
                  aria-pressed={theme === "dark"}
                  className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border text-sm font-bold transition-all [touch-action:manipulation] ${
                    theme === "dark"
                      ? "border-accent bg-accent-soft text-token"
                      : "border-token bg-surface text-token-muted hover:bg-surface-strong"
                  }`}
                >
                  <Moon className="size-4" />
                  Dark
                </button>
                <button
                  onClick={() => setTheme("light")}
                  aria-pressed={theme === "light"}
                  className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border text-sm font-bold transition-all [touch-action:manipulation] ${
                    theme === "light"
                      ? "border-accent bg-accent-soft text-token"
                      : "border-token bg-surface text-token-muted hover:bg-surface-strong"
                  }`}
                >
                  <Sun className="size-4" />
                  Light
                </button>
              </div>
            </section>

            {/* Twisty Timer Import */}
            <section className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-token-muted">Import from Twisty Timer</p>

              <div className="relative">
                <select
                  value={importEventId}
                  onChange={(e) => setImportEventId(e.target.value)}
                  className={selectClass}
                >
                  {EVENTS.map((ev) => (
                    <option key={ev.id} value={ev.id} className="bg-sheet">
                      {ev.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-token-muted pointer-events-none" />
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-token bg-surface px-3 text-sm font-bold text-token transition-colors hover:bg-surface-strong disabled:opacity-50 [touch-action:manipulation]"
              >
                {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {importing ? "Importing…" : "Choose .txt file"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                className="hidden"
                onChange={handleImportFile}
              />

              {importResult && (
                <div className="flex items-start gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm font-bold text-green-500">
                  <Check className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <p>Imported {importResult.solvesImported} of {importResult.solvesParsed} solve{importResult.solvesParsed !== 1 ? "s" : ""}</p>
                    {importResult.solvesImported < importResult.solvesParsed && (
                      <p className="text-xs font-normal text-green-500/70 mt-0.5">
                        {importResult.solvesParsed - importResult.solvesImported} skipped (already imported)
                      </p>
                    )}
                  </div>
                </div>
              )}
              {importError && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-500">
                  {importError}
                </div>
              )}
            </section>

            {/* Clear imported solves */}
            <section className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-token-muted">Remove Imported Solves</p>

              <div className="relative">
                <select
                  value={clearEventId}
                  onChange={(e) => { setClearEventId(e.target.value); setConfirmClear(false); setClearResult(null); setClearError(null); }}
                  className={selectClass}
                >
                  <option value="all" className="bg-sheet">All events</option>
                  {EVENTS.map((ev) => (
                    <option key={ev.id} value={ev.id} className="bg-sheet">{ev.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-token-muted pointer-events-none" />
              </div>

              {!confirmClear ? (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-token bg-surface px-3 text-sm font-bold text-red-500 transition-all hover:bg-red-500/10 hover:border-red-500/30 [touch-action:manipulation]"
                >
                  <Trash2 className="size-4" />
                  Clear imported solves
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-token-muted text-center">
                    This will permanently delete all Twisty Timer solves{clearEventId !== "all" ? ` for ${EVENTS.find(e => e.id === clearEventId)?.label}` : " across all events"}. Are you sure?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="min-h-10 flex-1 rounded-lg border border-token bg-surface text-sm font-bold text-token-muted hover:bg-surface-strong [touch-action:manipulation]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        setClearing(true);
                        setClearResult(null);
                        setClearError(null);
                        const result = await clearImportedSolves(cuberId, clearEventId);
                        setClearing(false);
                        setConfirmClear(false);
                        if (result.error) {
                          setClearError(result.error);
                        } else {
                          setClearResult({ deletedCount: result.deletedCount });
                        }
                      }}
                      disabled={clearing}
                      className="min-h-10 flex-1 rounded-lg border border-red-500/50 bg-red-500/20 text-sm font-bold text-red-500 hover:bg-red-500/30 disabled:opacity-50 [touch-action:manipulation]"
                    >
                      {clearing ? <Loader2 className="size-4 animate-spin mx-auto" /> : "Yes, delete"}
                    </button>
                  </div>
                </div>
              )}

              {clearResult && (
                <div className="flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm font-bold text-green-500">
                  <Check className="size-4 shrink-0" />
                  Deleted {clearResult.deletedCount} solve{clearResult.deletedCount !== 1 ? "s" : ""}
                </div>
              )}
              {clearError && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-500">
                  {clearError}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
