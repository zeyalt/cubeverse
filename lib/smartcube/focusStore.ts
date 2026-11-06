"use client";

/**
 * One boolean: is a solve in progress right now?
 *
 * The app shell hides the bottom nav while someone is solving (spec §4.4), and the shell is
 * several components above the tab that knows. A module-level store beats threading a prop through
 * `KidModeShell` → `TabContent` → `KidSmartTab`, and it keeps the shell from needing to know what a
 * solve even is.
 *
 * Deliberately dependency-free. The shell imports this, so it lands in the first-paint chunk; it
 * must not drag anything with it.
 */

import { useSyncExternalStore } from "react";

let focused = false;
const listeners = new Set<() => void>();

export function setSolveFocus(next: boolean): void {
  if (focused === next) return;
  focused = next;
  for (const listener of [...listeners]) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** True while a solve is running, so chrome can get out of the way. */
export function useSolveFocus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => focused,
    // Never focused on the server: a static export prerenders this, and a nav that renders hidden
    // then appears would be worse than one that renders and stays.
    () => false
  );
}
