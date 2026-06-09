"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Map our DB event IDs → scrambow event type strings. */
const SCRAMBOW_EVENT: Record<string, string> = {
  "333":   "333",
  "222":   "222",
  "444":   "444",
  "555":   "555",
  "666":   "666",
  "777":   "777",
  pyram:   "pyram",
  skewb:   "skewb",
  clock:   "clock",
  minx:    "minx",
  sq1:     "sq1",
  "333oh": "333",  // OH uses standard 3x3 scrambles
  "333bf": "333",  // BLD uses standard 3x3 scrambles
};

export function useScramble(eventId: string) {
  const [scramble, setScramble] = useState<string | null>(null);
  const busyRef = useRef(false);

  const generate = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setScramble(null);
    try {
      // Dynamic import keeps scrambow out of the server bundle.
      // scrambow has no @types package — suppress the TS error.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = await import("scrambow") as any;
      const Scrambow = mod.Scrambow ?? mod.default?.Scrambow ?? mod.default;
      const type = SCRAMBOW_EVENT[eventId] ?? "333";
      const result: string = new Scrambow().setType(type).get(1)[0].scramble_string;
      setScramble(result);
    } catch (err) {
      console.error("Scramble generation failed:", err);
      // Deterministic fallback so the user always gets something.
      setScramble("R U R' U' F2 R U R' U' F2");
    } finally {
      busyRef.current = false;
    }
  }, [eventId]);

  useEffect(() => {
    // generate() is async — setState is called after await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void generate();
  }, [generate]);

  return { scramble, next: generate };
}
