"use client";

import { useState, useEffect, useRef } from "react";
import { X, Moon, Sun, Download, Upload, Loader2, Check, ChevronDown, Trash2 } from "lucide-react";
import { exportAllData } from "@/app/actions/export";
import { importTwistyTimerData, clearImportedSolves } from "@/app/actions/import";

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

function useTheme() {
  const [theme, setThemeState] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const isDark = stored ? stored === "dark" : document.documentElement.classList.contains("dark");
    setThemeState(isDark ? "dark" : "light");
  }, []);

  function setTheme(t: "dark" | "light") {
    setThemeState(t);
    localStorage.setItem("theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }

  return { theme, setTheme };
}

export function SettingsSheet({ onClose, cuberId }: SettingsSheetProps) {
  const { theme, setTheme } = useTheme();

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

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

  async function handleExport() {
    setExporting(true);
    setExportDone(false);
    try {
      const data = await exportAllData();
      if (!data) throw new Error("Export failed");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cubeverse-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    } catch {
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

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

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none">
        <div
          className="bg-[#1C1916] rounded-2xl border-2 border-white/15 p-6 w-full max-w-sm pointer-events-auto space-y-6"
          style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.6)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-white">Settings</h2>
            <button
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Theme */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">Appearance</p>
            <div className="flex gap-2">
              <button
                onClick={() => setTheme("dark")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-3 font-bold transition-all ${
                  theme === "dark"
                    ? "border-[#0A0A0A] bg-[#1A1208] text-white"
                    : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
                }`}
                style={theme === "dark" ? { boxShadow: "3px 3px 0 #0A0A0A" } : undefined}
              >
                <Moon className="size-4" />
                Dark
              </button>
              <button
                onClick={() => setTheme("light")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-3 font-bold transition-all ${
                  theme === "light"
                    ? "border-[#0A0A0A] bg-[#F4EFE6] text-[#1A1208]"
                    : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
                }`}
                style={theme === "light" ? { boxShadow: "3px 3px 0 #0A0A0A" } : undefined}
              >
                <Sun className="size-4" />
                Light
              </button>
            </div>
          </div>

          {/* Export */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">Data</p>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="sticker w-full flex items-center justify-between rounded-xl border-2 border-[#0A0A0A] bg-[#0046AD] px-4 py-3 font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              style={{ boxShadow: "4px 4px 0 #0A0A0A" }}
            >
              <span className="flex items-center gap-2">
                {exporting ? <Loader2 className="size-4 animate-spin" /> : exportDone ? <Check className="size-4" /> : <Download className="size-4" />}
                {exporting ? "Exporting…" : exportDone ? "Downloaded!" : "Export data"}
              </span>
              <span className="text-xs text-white/60 font-normal">JSON backup</span>
            </button>
          </div>

          {/* Twisty Timer Import */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">Import from Twisty Timer</p>

            {/* Event selector */}
            <div className="relative">
              <select
                value={importEventId}
                onChange={(e) => setImportEventId(e.target.value)}
                className="w-full appearance-none rounded-xl border-2 border-white/15 bg-white/8 px-4 py-3 font-bold text-white focus:outline-none focus:border-white/30"
              >
                {EVENTS.map((ev) => (
                  <option key={ev.id} value={ev.id} className="bg-[#1C1916]">
                    {ev.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-white/40 pointer-events-none" />
            </div>

            {/* File picker */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="sticker w-full flex items-center justify-between rounded-xl border-2 border-[#0A0A0A] bg-[#009B48] px-4 py-3 font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              style={{ boxShadow: "4px 4px 0 #0A0A0A" }}
            >
              <span className="flex items-center gap-2">
                {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {importing ? "Importing…" : "Choose .txt file"}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              className="hidden"
              onChange={handleImportFile}
            />

            {importResult && (
              <div className="flex items-start gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm font-bold text-green-400">
                <Check className="size-4 shrink-0 mt-0.5" />
                <div>
                  <p>Imported {importResult.solvesImported} of {importResult.solvesParsed} solve{importResult.solvesParsed !== 1 ? "s" : ""}</p>
                  {importResult.solvesImported < importResult.solvesParsed && (
                    <p className="text-xs font-normal text-green-400/70 mt-0.5">
                      {importResult.solvesParsed - importResult.solvesImported} skipped (already imported)
                    </p>
                  )}
                </div>
              </div>
            )}
            {importError && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-400">
                {importError}
              </div>
            )}
          </div>

          {/* Clear imported solves */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">Remove Imported Solves</p>

            <div className="relative">
              <select
                value={clearEventId}
                onChange={(e) => { setClearEventId(e.target.value); setConfirmClear(false); setClearResult(null); setClearError(null); }}
                className="w-full appearance-none rounded-xl border-2 border-white/15 bg-white/8 px-4 py-3 font-bold text-white focus:outline-none focus:border-white/30"
              >
                <option value="all" className="bg-[#1C1916]">All events</option>
                {EVENTS.map((ev) => (
                  <option key={ev.id} value={ev.id} className="bg-[#1C1916]">{ev.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-white/40 pointer-events-none" />
            </div>

            {!confirmClear ? (
              <button
                onClick={() => setConfirmClear(true)}
                className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-white/15 bg-white/8 px-4 py-3 font-bold text-red-400 transition-all hover:bg-red-500/10 hover:border-red-500/30"
              >
                <Trash2 className="size-4" />
                Clear imported solves
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-white/50 text-center">
                  This will permanently delete all Twisty Timer solves{clearEventId !== "all" ? ` for ${EVENTS.find(e => e.id === clearEventId)?.label}` : " across all events"}. Are you sure?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="flex-1 rounded-xl border-2 border-white/10 bg-white/8 py-2.5 font-bold text-white/60 hover:bg-white/12"
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
                    className="flex-1 rounded-xl border-2 border-red-500/50 bg-red-500/20 py-2.5 font-bold text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                  >
                    {clearing ? <Loader2 className="size-4 animate-spin mx-auto" /> : "Yes, delete"}
                  </button>
                </div>
              </div>
            )}

            {clearResult && (
              <div className="flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm font-bold text-green-400">
                <Check className="size-4 shrink-0" />
                Deleted {clearResult.deletedCount} solve{clearResult.deletedCount !== 1 ? "s" : ""}
              </div>
            )}
            {clearError && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-400">
                {clearError}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
