"use client";

import { useState } from "react";
import { normalizeMac } from "@/lib/smartcube/mac";

/**
 * macOS hides a Bluetooth device's MAC address from the browser, and GAN's protocol needs it to
 * decrypt the cube's messages. Chrome can read it from the cube's broadcast once
 * `chrome://flags/#enable-experimental-web-platform-features` is on; without that, the person has
 * to look it up once. Asking for it deserves an explanation, not a bare `prompt()`.
 */
export function MacDialog({
  deviceName,
  onSubmit,
  onCancel,
}: {
  deviceName: string;
  onSubmit: (mac: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const mac = normalizeMac(value);
    if (!mac) {
      setError("That doesn't look like a MAC address. It should be six pairs, like 54:6C:50:FA:5B:84.");
      return;
    }
    onSubmit(mac);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <form
        onSubmit={submit}
        className="surface w-full max-w-md rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-bold text-token">
          One-time setup for {deviceName}
        </h2>
        <p className="mt-2 text-sm text-token-muted">
          This cube encrypts what it sends, using its own Bluetooth address as the key. Your browser
          can normally read that address by itself, but the API for it is still behind a Chrome
          flag.
        </p>

        <p className="mt-3 text-sm font-bold text-token">Skip this for good</p>
        <p className="mt-1 text-sm text-token-muted">
          Turn on{" "}
          <code className="rounded bg-surface-strong px-1 py-0.5 text-xs">
            chrome://flags/#enable-experimental-web-platform-features
          </code>{" "}
          and restart Chrome. Every cube then connects without asking.
        </p>

        <p className="mt-3 text-sm font-bold text-token">Or enter it once</p>
        <p className="mt-1 text-sm text-token-muted">
          Run{" "}
          <code className="rounded bg-surface-strong px-1 py-0.5 text-xs">
            system_profiler SPBluetoothDataType
          </code>{" "}
          in Terminal and copy the address shown next to your cube. Saved for next time.
        </p>
        <input
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="54:6C:50:FA:5B:84"
          spellCheck={false}
          autoComplete="off"
          aria-label="Cube Bluetooth address"
          className="mt-4 w-full rounded-xl border border-token bg-surface px-3 py-2 font-mono text-sm text-token focus:border-token-strong focus:outline-none"
        />
        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-token px-4 py-2 text-sm font-bold text-token-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-xl px-4 py-2 text-sm font-bold text-black"
            style={{ backgroundColor: "var(--kid-accent)" }}
          >
            Connect
          </button>
        </div>
      </form>
    </div>
  );
}
