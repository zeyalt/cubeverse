import { ganDriver } from "./gan";
import type { ConnectContext, CubeDriver, SmartCube } from "./types";

/**
 * Registry of supported brands. Adding MoYu, QiYi, GoCube/Rubik's Connected or Giiker means
 * writing a driver and listing it here — each needs its own hardware to verify, so they land one
 * at a time rather than speculatively.
 */
export const DRIVERS: readonly CubeDriver[] = [ganDriver];

const driverFor = (device: BluetoothDevice) =>
  DRIVERS.find((driver) => driver.namePrefixes.some((prefix) => device.name?.startsWith(prefix)));

/** One chooser listing every supported brand, then hand off to whichever driver matches. */
export async function connectSmartCube(ctx: ConnectContext): Promise<SmartCube> {
  if (typeof navigator === "undefined" || !navigator.bluetooth) {
    throw new Error("Web Bluetooth is not available in this browser.");
  }
  const device = await navigator.bluetooth.requestDevice({
    filters: DRIVERS.flatMap((d) => d.namePrefixes.map((namePrefix) => ({ namePrefix }))),
    optionalServices: [...new Set(DRIVERS.flatMap((d) => d.optionalServices))],
    optionalManufacturerData: [...new Set(DRIVERS.flatMap((d) => d.optionalManufacturerData ?? []))],
  });
  const driver = driverFor(device);
  if (!driver) throw new Error(`No driver matches "${device.name ?? "this device"}".`);
  return driver.connect(device, ctx);
}

export type {
  ConnectContext,
  CubeCapabilities,
  CubeEvent,
  CubeHardwareInfo,
  SmartCube,
} from "./types";
