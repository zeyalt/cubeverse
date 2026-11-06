/**
 * Web Bluetooth is Chrome/Edge on desktop and Android only. Every iOS browser is WebKit
 * underneath, so no iPhone or iPad can ever connect a smart cube from the web — that is a platform
 * limit, not something a flag or a newer build fixes.
 *
 * The nav hides the tab where it can't work, but `?tab=smart` still reaches an explanation, so
 * somebody who read about the feature can find out why they can't see it.
 */

export const isWebBluetoothSupported = (): boolean =>
  typeof navigator !== "undefined" && "bluetooth" in navigator;

export type UnsupportedReason = "ios" | "firefox" | "safari" | "insecure" | "unknown";

export function unsupportedReason(): UnsupportedReason | null {
  if (typeof navigator === "undefined") return "unknown";
  if (isWebBluetoothSupported()) {
    // Served over plain HTTP on a LAN address, the API exists but every call fails.
    return typeof window !== "undefined" && !window.isSecureContext ? "insecure" : null;
  }
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return "safari";
  return "unknown";
}

export function unsupportedMessage(reason: UnsupportedReason): { title: string; detail: string } {
  switch (reason) {
    case "ios":
      return {
        title: "Smart cubes don't work on iPhone or iPad",
        detail:
          "Apple doesn't allow Bluetooth in any iOS browser, so no app on the web can connect a cube here. Use Cubeverse on Chrome on Android, Mac or Windows to use your smart cube.",
      };
    case "firefox":
      return {
        title: "Firefox can't connect to a smart cube",
        detail: "Firefox doesn't support Web Bluetooth. Open Cubeverse in Chrome or Edge instead.",
      };
    case "safari":
      return {
        title: "Safari can't connect to a smart cube",
        detail: "Safari doesn't support Web Bluetooth. Open Cubeverse in Chrome or Edge instead.",
      };
    case "insecure":
      return {
        title: "This page isn't on a secure connection",
        detail:
          "Bluetooth only works over HTTPS, or on localhost. Open Cubeverse over https:// and try again.",
      };
    default:
      return {
        title: "This browser can't connect to a smart cube",
        detail: "Web Bluetooth isn't available here. Chrome or Edge on Android, Mac or Windows will work.",
      };
  }
}
