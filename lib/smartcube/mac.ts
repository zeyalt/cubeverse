/**
 * GAN's protocol salts its AES key with the cube's Bluetooth MAC address — and macOS hides that
 * from the browser. So getting the MAC is a genuine part of connecting, not an edge case.
 *
 * Order of attempts: remembered for this device → the library's own auto-detect (reads it from
 * advertisement data, needs an experimental Chrome flag) → ask the user. Once we have it, it is
 * remembered per device so nobody is asked twice.
 */

const STORAGE_KEY = "cubeverse.smartcube.macs";
const MAC_RE = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;

/** Accepts colon-, dash- and bare-hex forms; returns the canonical form, or null if unusable. */
export function normalizeMac(input: string): string | null {
  const value = input.trim().toUpperCase().replace(/-/g, ":");
  if (MAC_RE.test(value)) return value;
  if (/^[0-9A-F]{12}$/.test(value)) return value.match(/../g)!.join(":");
  return null;
}

type Stored = Record<string, string>;

function load(): Stored {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Stored) : {};
  } catch {
    return {};
  }
}

/** Key by id and by name: the id is stable per origin, the name is what a person recognises. */
const keysFor = (device: Pick<BluetoothDevice, "id" | "name">) =>
  [device.id, device.name ?? ""].filter(Boolean);

export function rememberMac(deviceKey: string, mac: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...load(), [deviceKey]: mac }));
  } catch {
    // Storage unavailable or full: the user will simply be asked again next time.
  }
}

export function recallMac(device: Pick<BluetoothDevice, "id" | "name">): string | null {
  const stored = load();
  for (const key of keysFor(device)) if (stored[key]) return stored[key];
  return null;
}

export function forgetMacs(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do; a failed clear is not worth surfacing.
  }
}
