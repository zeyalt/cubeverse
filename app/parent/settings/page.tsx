"use client";

import { useCallback, useSyncExternalStore } from "react";
import { exportAllData } from "@/app/actions/export";
import { PageHeader } from "@/components/parent/PageHeader";
import { Button } from "@/components/ui/button";
import { Download, Moon, Sun } from "lucide-react";
import { useState } from "react";

function subscribeDarkMode(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export default function SettingsPage() {
  const [exporting, setExporting] = useState(false);

  const darkMode = useSyncExternalStore(
    subscribeDarkMode,
    () => document.documentElement.classList.contains("dark"),
    () => false
  );

  const toggleDarkMode = useCallback(() => {
    const html = document.documentElement;
    if (html.classList.contains("dark")) {
      html.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      html.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
  }, []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const data = await exportAllData();
      if (!data) {
        alert("Export failed");
        return;
      }
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cubeverse-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Export failed");
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <div className="space-y-8 max-w-2xl">
      <PageHeader
        title="Settings"
        description="Theme, backup, and app preferences."
      />

      {/* Dark mode toggle */}
      <section className="parent-surface">
        <div className="parent-surface-header">
          <h2 className="font-semibold text-foreground">Theme</h2>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="font-medium text-foreground">Dark mode</p>
            <p className="text-xs text-muted-foreground">Easier on the eyes at night</p>
          </div>
          <button
            onClick={toggleDarkMode}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
              darkMode
                ? "bg-[#1A1208] text-[#FFD500]"
                : "bg-[#F4EFE6] text-[#0046AD]"
            }`}
          >
            {darkMode ? (
              <Moon className="size-4" />
            ) : (
              <Sun className="size-4" />
            )}
            {darkMode ? "Dark" : "Light"}
          </button>
        </div>
      </section>

      {/* Backup & export */}
      <section className="parent-surface">
        <div className="parent-surface-header">
          <h2 className="font-semibold text-foreground">Backup</h2>
        </div>
        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-muted-foreground">
            Download all your data as JSON (competitions, PBs, goals, achievements, cubes, journal).
            Perfect for backups or migration.
          </p>
          <Button
            onClick={handleExport}
            disabled={exporting}
            className="sticker"
          >
            <Download className="size-4 mr-2" />
            {exporting ? "Exporting…" : "Export data"}
          </Button>
        </div>
      </section>

      {/* Coming soon */}
      <section className="parent-surface opacity-60">
        <div className="parent-surface-header">
          <h2 className="font-semibold text-foreground">Multi-cuber</h2>
        </div>
        <div className="flex items-center justify-center px-5 py-8">
          <p className="text-sm text-muted-foreground">Coming soon — manage multiple cubers</p>
        </div>
      </section>
    </div>
  );
}
