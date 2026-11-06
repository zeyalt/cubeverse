"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { Bluetooth, BluetoothOff, Box } from "lucide-react";
import { TabLoading } from "./lazyTabs";
import { MacDialog } from "@/components/smartcube/MacDialog";
import { Segmented } from "@/components/smartcube/Segmented";
import { SolveFlow } from "@/components/smartcube/SolveFlow";
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
import { isWebBluetoothSupported, unsupportedMessage, unsupportedReason } from "@/lib/smartcube/support";

/**
 * Smart cube tab: Timer, History, Insights.
 *
 * Self-contained, as decided: smart-cube solves never reach the app's PBs, badges or Analytics, so
 * their history and insights live here rather than in those tabs.
 *
 * Laid out as one centred column at phone width on every screen. On a desktop window the earlier
 * version stretched its tables edge to edge, with 9 px labels a metre apart; a timer is something
 * you glance at, and a glance needs everything close together.
 *
 * Heavy pieces load only when needed: three.js and the Bluetooth stack on connect, and the charts
 * (recharts) only when History or Insights is opened, so the timer itself stays light.
 */
const Cube3DView = dynamic(() => import("@/components/smartcube/Cube3DView"), {
  ssr: false,
  loading: () => <TabLoading />,
});
const HistoryView = dynamic(
  () => import("@/components/smartcube/HistoryView").then((m) => m.HistoryView),
  { ssr: false, loading: () => <TabLoading /> }
);
const InsightsView = dynamic(
  () => import("@/components/smartcube/InsightsView").then((m) => m.InsightsView),
  { ssr: false, loading: () => <TabLoading /> }
);

type Section = "timer" | "history" | "insights";
const SECTIONS: ReadonlyArray<{ value: Section; label: string }> = [
  { value: "timer", label: "Timer" },
  { value: "history", label: "History" },
  { value: "insights", label: "Insights" },
];

export function KidSmartTab({ cuberId }: { cuberId: string }) {
  const cube = useSmartCube();
  const session = useSmartSolve(cuberId, "333");
  const [section, setSection] = useState<Section>("timer");
  const [macRequest, setMacRequest] = useState<{
    name: string;
    resolve: (mac: string | null) => void;
  } | null>(null);

  const supported = isWebBluetoothSupported();
  const reason = unsupportedReason();
  const solving = session.solve.phase === "solving";

  // Hide the app's bottom nav for the duration of a solve, and restore it on unmount so a tab
  // switch can never leave it hidden.
  useEffect(() => {
    setSolveFocus(solving);
    return () => setSolveFocus(false);
  }, [solving]);

  // U×4 re-reads the cube, D×4 declares it solved: the sync prompt can be answered without putting
  // the cube down. Armed only while the prompt is up, so four U turns in a solve stay four U turns.
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

  // A penalty on the solve just finished reaches the state machine (so the time on screen updates)
  // and the saved record (so it survives a reload).
  const { setPenalty, setSolvePenalty, latest } = session;
  const onPenalty = useCallback(
    (penalty: "none" | "plus2" | "dnf") => {
      setPenalty(penalty);
      if (latest) void setSolvePenalty(latest.id, penalty);
    },
    [setPenalty, setSolvePenalty, latest]
  );

  if (!supported && reason) {
    const { title, detail } = unsupportedMessage(reason);
    return (
      <div className="mx-auto w-full max-w-xl px-4 pt-2 pb-4">
        <div className="surface rounded-3xl p-6 text-center">
          <BluetoothOff className="mx-auto size-8 text-token-muted" />
          <h2 className="font-display mt-3 text-lg font-bold text-token">{title}</h2>
          <p className="mt-2 text-sm text-token-muted">{detail}</p>
        </div>
      </div>
    );
  }

  const connected = cube.status === "connected";
  const solveNumber = session.solves.length + 1;
  const liveCube = <Cube3DView facelets={cube.facelets} className="absolute inset-0" />;

  // While solving: the cube and the time, and nothing that could be mis-tapped.
  if (solving) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-4">
        <SolveFlow
          solve={session.solve}
          solveNumber={solveNumber}
          cube={liveCube}
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
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 pt-2 pb-4">
      {macRequest ? (
        <MacDialog
          deviceName={macRequest.name}
          onSubmit={(mac) => macRequest.resolve(mac)}
          onCancel={() => macRequest.resolve(null)}
        />
      ) : null}

      <CubePill
        status={cube.status}
        name={connected ? `${cube.brand} ${cube.name}` : null}
        battery={cube.battery}
        onConnect={() => void onConnect()}
        onDisconnect={() => void disconnect()}
      />

      <Segmented label="Smart cube sections" options={SECTIONS} value={section} onChange={setSection} />

      {cube.error ? (
        <div role="alert" className="surface rounded-2xl border-l-4 border-red-500 p-4 text-sm text-token-muted">
          {cube.error}
        </div>
      ) : null}

      {session.loadError ? (
        <div className="surface rounded-2xl p-4 text-sm text-token-muted">
          Couldn&apos;t load earlier solves. Timing still works, and new solves sync when the
          connection is back.
        </div>
      ) : null}

      {section === "timer" ? (
        <>
          {cube.needsSync ? <SyncPrompt /> : null}

          {connected && !cube.needsSync ? (
            <SolveFlow
              solve={session.solve}
              solveNumber={solveNumber}
              cube={liveCube}
              inspectionMs={session.inspectionMs}
              liveMs={session.liveMs}
              latest={session.latest}
              onStartInspection={session.startInspection}
              onNextScramble={session.nextScramble}
              onPenalty={onPenalty}
            />
          ) : null}

          {!connected ? (
            <ConnectHero connecting={cube.status === "connecting"} onConnect={() => void onConnect()} />
          ) : null}

          <StatsTable solves={session.solves} onSelect={() => setSection("history")} />
        </>
      ) : null}

      {section === "history" ? (
        <HistoryView
          solves={session.solves}
          onPenalty={(id, penalty) => void session.setSolvePenalty(id, penalty)}
          onDelete={(id) => void session.removeSolve(id)}
        />
      ) : null}

      {section === "insights" ? <InsightsView cuberId={cuberId} solves={session.solves} /> : null}
    </div>
  );
}

/** Which cube, its battery, and the one connection action that applies right now. */
function CubePill({
  status,
  name,
  battery,
  onConnect,
  onDisconnect,
}: {
  status: "disconnected" | "connecting" | "connected";
  name: string | null;
  battery: number | null;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const connected = status === "connected";
  return (
    <div className="surface flex min-h-14 items-center gap-3 rounded-full py-2 pr-2 pl-4">
      <Bluetooth
        className="size-4 shrink-0"
        style={{ color: connected ? "#3dbb92" : undefined }}
        aria-hidden
      />
      <p className="min-w-0 flex-1 truncate text-sm font-bold text-token">
        {connected ? name : status === "connecting" ? "Connecting…" : "No cube connected"}
      </p>
      {connected && battery !== null ? (
        <span
          className="flex shrink-0 items-center gap-1.5 text-xs font-bold tabular-nums text-token-muted"
          aria-label={`Battery ${battery}%`}
        >
          {/* Green, amber, red at the spec's thresholds: a cube about to die is worth a glance. */}
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: battery > 30 ? "#3dbb92" : battery > 15 ? "#e0a33e" : "#ef4444" }}
          />
          {battery}%
        </span>
      ) : null}
      {connected ? (
        <button
          onClick={onDisconnect}
          className="min-h-10 shrink-0 cursor-pointer rounded-full border border-token px-4 text-xs font-bold text-token-muted hover:text-token"
        >
          Disconnect
        </button>
      ) : status === "disconnected" ? (
        <button
          onClick={onConnect}
          className="min-h-10 shrink-0 cursor-pointer rounded-full px-4 text-sm font-bold text-black"
          style={{ backgroundColor: "var(--kid-accent)" }}
        >
          Connect
        </button>
      ) : null}
    </div>
  );
}

/**
 * The timer card's place when no cube is connected: what to do, and the button to do it.
 *
 * No 3D cube here, deliberately — drawing one would load three.js before the person has decided to
 * connect, which is the cost the whole tab is built to avoid.
 */
function ConnectHero({ connecting, onConnect }: { connecting: boolean; onConnect: () => void }) {
  return (
    <div className="surface relative overflow-hidden rounded-3xl px-6 py-10 text-center">
      <Box className="pointer-events-none absolute left-1/2 top-1/2 size-56 -translate-x-1/2 -translate-y-1/2 text-token opacity-[0.05]" aria-hidden />
      <div className="relative">
        <p className="font-display text-lg font-bold text-token">Connect your smart cube</p>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-token-muted">
          It checks your scramble turn by turn, starts the timer on your first move and stops it
          the moment the cube is solved.
        </p>
        <button
          onClick={onConnect}
          disabled={connecting}
          className="mt-5 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full px-6 font-bold text-black disabled:opacity-50"
          style={{ backgroundColor: "var(--kid-accent)" }}
        >
          <Bluetooth className="size-4" />
          {connecting ? "Choose your cube in the browser…" : "Connect"}
        </button>
        <p className="mt-4 text-xs text-token-muted">No smart cube? The Practice tab has a manual timer.</p>
      </div>
    </div>
  );
}

/** Shown when the cube's own state doesn't look solved on connect — usually drift, not a scramble. */
function SyncPrompt() {
  return (
    <div className="surface rounded-3xl p-5">
      <p className="font-display text-base font-bold text-token">Is your cube solved?</p>
      <p className="mt-1 text-sm text-token-muted">
        Your cube thinks it&apos;s scrambled. Its memory drifts when it&apos;s turned while
        disconnected, so if it&apos;s actually solved, tell it.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => void markSolved()}
          className="min-h-11 cursor-pointer rounded-xl px-4 text-sm font-bold text-black"
          style={{ backgroundColor: "var(--kid-accent)" }}
        >
          It&apos;s solved
        </button>
        <button
          onClick={() => void requestState()}
          className="min-h-11 cursor-pointer rounded-xl border border-token px-4 text-sm font-bold text-token-muted"
        >
          Re-read cube
        </button>
      </div>
      <p className="mt-3 text-xs text-token-muted">
        Or on the cube itself: turn D four times for solved, U four times to re-read.
      </p>
    </div>
  );
}
