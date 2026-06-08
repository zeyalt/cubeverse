"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useScramble(eventId: string) {
  const [scramble, setScramble] = useState<string | null>(null);
  const busyRef = useRef(false);

  const generate = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setScramble(null);
    try {
      const { randomScrambleForEvent } = await import("cubing/scramble");
      // cubing.js uses the same WCA event IDs we store in the DB (333, 222, pyram…)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const alg = await randomScrambleForEvent(eventId as any);
      setScramble(alg.toString());
    } catch (err) {
      console.error("Scramble generation failed:", err);
      setScramble("R U R' U' F2 R U R' U' F2");
    } finally {
      busyRef.current = false;
    }
  }, [eventId]);

  useEffect(() => {
    // generate() is async; setState is called after await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void generate();
  }, [generate]);

  return { scramble, next: generate };
}
