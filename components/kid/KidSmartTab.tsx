"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bluetooth, BluetoothOff, Download } from "lucide-react";
import { TabLoading } from "./lazyTabs";
import { MacDialog } from "@/components/smartcube/MacDialog";
import { ReconstructionCard } from "@/components/smartcube/ReconstructionCard";
import { SessionInsights } from "@/components/smartcube/SessionInsights";
import { SolveFlow } from "@/components/smartcube/SolveFlow";
import { useSmartSolve } from "@/lib/smartcube/useSmartSolve";
import {
  connect,
  disconnect,
  markSolved,
  requestState,
  subscribeEvents,
  useSmartCube,
} from "@/lib/smartcube/useSmartCube";
import { isSolved } from "@/lib/smartcube/facelets";
import { isWebBluetoothSupported, unsupportedMessage, unsupportedReason } from "@/lib/smartcube/support";
import type { CubeEvent } from "@/lib/smartcube/drivers/types";

/**
 * Smart cube tab.
 *
 * Everything heavy — three.js and the Bluetooth stack — is behind a dynamic import that only runs
 * when the person actually connects, so opening this tab costs a few KB and nothing more.
 */
const Cube3DView = dynamic(() => import("@/components/smartcube/Cube3DView"), {
  ssr: false,
  loading: () => <TabLoading />,
});

/** Raw capture for building test fixtures from real hardware. */
type LogEntry = { t: number; event: CubeEvent };
const MAX_LOG = 5000;

export function KidSmartTab({ cuberId }: { cuberId: string }) {
  const cube = useSmartCube();
  const session = useSmartSolve(cuberId, "333");
  const [macRequest, setMacRequest] = useState<{
    name: string;
    resolve: (mac: string | null) => void;
  } | null>(null);
  const [recording, setRecording] = useState(false);
  const [logCount, setLogCount] = useState(0);
  const logRef = useRef<LogEntry[]>([]);

  const supported = isWebBluetoothSupported();
  const reason = unsupportedReason();

  // Raw event capture, only while armed.
  useEffect(() => {
    if (!recording) return;
    return subscribeEvents((event) => {
      if (event.type === "gyro") return;
      const log = logRef.current;
      if (log.length >= MAX_LOG) return;
      log.push({ t: Math.round(performance.now()), event });
      setLogCount(log.length);
    });
  }, [recording]);

  const onConnect = useCallback(async () => {
    await connect({
      askMac: (device) =>
        new Promise<string | null>((resolve) => {
          setMacRequest({
            name: device.name ?? "your cube",
            resolve: (mac) => {
              setMacRequest(null);
              resolve(mac);
            },
          });
        }),
    });
  }, []);

  const downloadLog = useCallback(() => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            capturedAt: new Date().toISOString(),
            cuberId,
            device: cube.name,
            brand: cube.brand,
            hardware: cube.hardware,
            userAgent: typeof navigator === "undefined" ? null : navigator.userAgent,
            entries: logRef.current,
          },
          null,
          1
        ),
      ],
      { type: "application/json" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `smartcube-capture-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [cube.brand, cube.hardware, cube.name, cuberId]);

  if (!supported && reason) {
    const { title, detail } = unsupportedMessage(reason);
    return (
      <div className="space-y-5 px-3 pt-2 pb-4">
        <div className="surface rounded-2xl p-5 text-center">
          <BluetoothOff className="mx-auto size-8 text-token-muted" />
          <h2 className="font-display mt-3 text-lg font-bold text-token">{title}</h2>
          <p className="mt-2 text-sm text-token-muted">{detail}</p>
        </div>
      </div>
    );
  }

  const connected = cube.status === "connected";
  const solved = isSolved(cube.facelets);

  return (
    <div className="space-y-4 px-3 pt-2 pb-4">
      {macRequest ? (
        <MacDialog
          deviceName={macRequest.name}
          onSubmit={(mac) => macRequest.resolve(mac)}
          onCancel={() => macRequest.resolve(null)}
        />
      ) : null}

      <div className="surface flex items-center gap-3 rounded-2xl p-4">
        <Bluetooth
          className="size-5 shrink-0"
          style={{ color: connected ? "var(--kid-accent)" : undefined }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-token">
            {connected ? `${cube.brand} ${cube.name}` : "No cube connected"}
          </p>
          <p className="truncate text-xs text-token-muted">
            {cube.status === "connecting"
              ? "Choose your cube in the browser dialog…"
              : connected
                ? [
                    cube.battery !== null ? `${cube.battery}% battery` : null,
                    cube.hardware?.softwareVersion ? `firmware ${cube.hardware.softwareVersion}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Connected"
                : "Connect a GAN smart cube to see it move here."}
          </p>
        </div>
        {connected ? (
          <button
            onClick={() => void disconnect()}
            className="rounded-xl border border-token px-3 py-2 text-xs font-bold text-token-muted"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={() => void onConnect()}
            disabled={cube.status === "connecting"}
            className="rounded-xl px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
            style={{ backgroundColor: "var(--kid-accent)" }}
          >
            Connect
          </button>
        )}
      </div>

      {cube.error ? (
        <div className="surface rounded-2xl border-l-4 border-red-500 p-4 text-sm text-token-muted">
          {cube.error}
        </div>
      ) : null}

      {cube.needsSync ? (
        <div className="surface rounded-2xl p-4">
          <p className="text-sm text-token">
            Your cube thinks it&apos;s scrambled. If it&apos;s actually solved, tell it so — its
            memory drifts when you turn it while disconnected.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => void markSolved()}
              className="rounded-xl px-4 py-2 text-sm font-bold text-black"
              style={{ backgroundColor: "var(--kid-accent)" }}
            >
              It&apos;s solved
            </button>
            <button
              onClick={() => void requestState()}
              className="rounded-xl border border-token px-4 py-2 text-sm font-bold text-token-muted"
            >
              Re-read cube
            </button>
          </div>
        </div>
      ) : null}

      {connected ? (
        <>
          {!cube.needsSync ? (
            <SolveFlow
              solve={session.solve}
              inspectionMs={session.inspectionMs}
              liveMs={session.liveMs}
              onStartInspection={session.startInspection}
              onNextScramble={session.nextScramble}
            />
          ) : null}

          <div className="surface relative overflow-hidden rounded-2xl" style={{ height: "clamp(230px, 38vh, 360px)" }}>
            <Cube3DView facelets={cube.facelets} className="absolute inset-0" />
            <span className="absolute left-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              {solved ? "Solved" : "Scrambled"}
            </span>
            <span className="absolute right-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              {cube.moveCount} turns{cube.lastMove ? ` · ${cube.lastMove}` : ""}
            </span>
          </div>

          {session.latest && session.solve.phase === "solved" ? (
            <ReconstructionCard solve={session.latest} />
          ) : null}

          <SessionInsights solves={session.solves} />

          {/* Development aid: capture real hardware output as test fixtures. */}
          <div className="surface rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-token">Record a capture</p>
                <p className="text-xs text-token-muted">
                  {recording ? `${logCount} events recorded` : "Saves raw cube output as test data."}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => setRecording((r) => !r)}
                  className="rounded-xl border border-token px-3 py-2 text-xs font-bold text-token-muted"
                >
                  {recording ? "Stop" : "Record"}
                </button>
                <button
                  onClick={downloadLog}
                  disabled={logCount === 0}
                  aria-label="Download capture"
                  className="rounded-xl border border-token p-2 text-token-muted disabled:opacity-40"
                >
                  <Download className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
