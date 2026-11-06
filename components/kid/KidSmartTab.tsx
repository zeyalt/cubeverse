"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bluetooth, BluetoothOff, Download } from "lucide-react";
import { TabLoading } from "./lazyTabs";
import { MacDialog } from "@/components/smartcube/MacDialog";
import { ReconstructionCard } from "@/components/smartcube/ReconstructionCard";
import { SessionInsights } from "@/components/smartcube/SessionInsights";
import { ScrambleNavigator, SolveFlow } from "@/components/smartcube/SolveFlow";
import { StatsTable } from "@/components/smartcube/StatsTable";
import { useSmartSolve } from "@/lib/smartcube/useSmartSolve";
import { setSolveFocus } from "@/lib/smartcube/focusStore";
import { createGestureDetector } from "@/lib/smartcube/gestures";
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
 *
 * While a solve is running the tab shows the cube and the time and nothing else (spec §4.4). That
 * isn't minimalism for its own sake: a scramble, a stats table and a row of tab icons in peripheral
 * vision during a timed solve are all distractions, and one of them is a mis-tap away from
 * navigating out of the solve.
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
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const logRef = useRef<LogEntry[]>([]);

  const supported = isWebBluetoothSupported();
  const reason = unsupportedReason();
  const solving = session.solve.phase === "solving";

  // Hide the app's bottom nav for the duration of the solve, and put it back on unmount so a tab
  // switch mid-solve can't leave the nav hidden with no way to bring it back.
  useEffect(() => {
    setSolveFocus(solving);
    return () => setSolveFocus(false);
  }, [solving]);

  // `U×4` confirms the tracked state, `D×4` declares the cube solved — the gestures from §4.5, so
  // the sync prompt can be answered without putting the cube down. Only armed while that prompt is
  // up, since four U turns during a solve must stay four U turns.
  useEffect(() => {
    if (!cube.needsSync) return;
    const detector = createGestureDetector(["U", "D"]);
    return subscribeEvents((event) => {
      if (event.type !== "move") return;
      const gesture = detector.push(event.move, event.localTs);
      if (gesture === "U") void requestState();
      if (gesture === "D") void markSolved();
    });
  }, [cube.needsSync]);

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

  // A penalty on the finished solve has to reach two places: the state machine, so the time on
  // screen updates, and the saved record, so it survives a reload.
  const onPenalty = useCallback(
    (penalty: "none" | "plus2" | "dnf") => {
      session.setPenalty(penalty);
      if (session.latest) void session.setSolvePenalty(session.latest.id, penalty);
    },
    [session]
  );

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
  const solveNumber = session.solves.length + 1;
  const reviewing = reviewingId
    ? session.solves.find((s) => s.id === reviewingId) ?? null
    : null;

  // While solving: the cube, the time, nothing else.
  if (solving) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-4 px-3 py-4">
        <div
          className="surface relative overflow-hidden rounded-2xl"
          style={{ height: "clamp(200px, 32vh, 300px)" }}
        >
          <Cube3DView facelets={cube.facelets} className="absolute inset-0" />
        </div>
        <SolveFlow
          solve={session.solve}
          solveNumber={solveNumber}
          inspectionMs={session.inspectionMs}
          liveMs={session.liveMs}
          latest={session.latest}
          onStartInspection={session.startInspection}
          onNextScramble={session.nextScramble}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 px-3 pt-2 pb-4">
      {macRequest ? (
        <MacDialog
          deviceName={macRequest.name}
          onSubmit={(mac) => macRequest.resolve(mac)}
          onCancel={() => macRequest.resolve(null)}
        />
      ) : null}

      {/* Header pill: who's connected, and how much battery it has left. */}
      <div className="surface flex items-center gap-3 rounded-full p-2 pl-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-token">
            {connected ? `${cube.brand} ${cube.name}` : "No cube connected"}
          </p>
          <p className="truncate text-[11px] text-token-muted">
            {cube.status === "connecting"
              ? "Choose your cube in the browser dialog…"
              : connected
                ? cube.hardware?.softwareVersion
                  ? `Firmware ${cube.hardware.softwareVersion}`
                  : "Connected"
                : "Connect a GAN smart cube to see it move here."}
          </p>
        </div>
        {connected ? (
          <>
            {cube.battery !== null ? (
              <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-token px-2.5 py-1 text-[11px] font-bold tabular-nums text-token-muted">
                <span
                  className="size-1.5 rounded-full"
                  style={{
                    // Green, amber, red at the thresholds in §5.6 — a cube that dies mid-session
                    // is worth a glance's warning.
                    backgroundColor:
                      cube.battery > 30 ? "#4bb08a" : cube.battery > 15 ? "#e0a33e" : "#ef4444",
                  }}
                />
                {cube.battery}%
              </span>
            ) : null}
            <button
              onClick={() => void disconnect()}
              className="shrink-0 rounded-full border border-token px-3 py-2 text-xs font-bold text-token-muted"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={() => void onConnect()}
            disabled={cube.status === "connecting"}
            className="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
            style={{ backgroundColor: "var(--kid-accent)" }}
          >
            <Bluetooth className="size-4" /> Connect
          </button>
        )}
      </div>

      {cube.error ? (
        <div className="surface rounded-2xl border-l-4 border-red-500 p-4 text-sm text-token-muted">
          {cube.error}
        </div>
      ) : null}

      {session.loadError ? (
        <div className="surface rounded-2xl p-4 text-sm text-token-muted">
          Couldn&apos;t load your earlier smart-cube solves. This session still works and anything
          you solve now will sync when the connection is back.
        </div>
      ) : null}

      {cube.needsSync ? (
        <div className="surface rounded-2xl p-4">
          <p className="text-sm text-token">
            Your cube thinks it&apos;s scrambled. If it&apos;s actually solved, tell it so — its
            memory drifts when you turn it while disconnected.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => void markSolved()}
              className="rounded-xl px-4 py-2 text-sm font-bold text-black"
              style={{ backgroundColor: "var(--kid-accent)" }}
            >
              It&apos;s solved <span className="font-mono opacity-60">D×4</span>
            </button>
            <button
              onClick={() => void requestState()}
              className="rounded-xl border border-token px-4 py-2 text-sm font-bold text-token-muted"
            >
              Re-read cube <span className="font-mono opacity-60">U×4</span>
            </button>
          </div>
          <p className="mt-2 text-xs text-token-muted">
            Or do it on the cube: four turns of D to mark it solved, four of U to re-read it.
          </p>
        </div>
      ) : null}

      {connected ? (
        <>
          {!cube.needsSync ? (
            <>
              <ScrambleNavigator
                solveNumber={solveNumber}
                eventLabel="3x3x3"
                canGoBack={session.solves.length > 0}
                onPrevious={() => setReviewingId(session.solves[0]?.id ?? null)}
                onNext={session.nextScramble}
              />
              <SolveFlow
                solve={session.solve}
                solveNumber={solveNumber}
                inspectionMs={session.inspectionMs}
                liveMs={session.liveMs}
                latest={session.latest}
                onStartInspection={session.startInspection}
                onNextScramble={session.nextScramble}
                onPenalty={onPenalty}
              />
            </>
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

          {reviewing ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-token-muted">
                  Earlier solve
                </p>
                <button
                  onClick={() => setReviewingId(null)}
                  className="text-xs font-bold text-token-muted"
                >
                  Close
                </button>
              </div>
              <ReconstructionCard solve={reviewing} />
            </div>
          ) : session.latest && session.solve.phase === "solved" ? (
            <ReconstructionCard solve={session.latest} />
          ) : null}

          <StatsTable solves={session.solves} onSelect={(solve) => setReviewingId(solve.id)} />

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
      ) : (
        /* Solves outlive the connection, so the session's numbers stay on screen after a
           disconnect rather than vanishing with the cube. */
        <StatsTable solves={session.solves} onSelect={(solve) => setReviewingId(solve.id)} />
      )}
    </div>
  );
}
