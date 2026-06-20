"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders a 2D visual of the cube state after applying `scramble`, using the
 * `scramble-display` web component (cubing.js under the hood).
 *
 * The component is a custom element that relies on browser-only APIs, so it is
 * imported dynamically inside an effect — never on the server.
 */
export function ScramblePreview({
  event,
  scramble,
  className,
}: {
  event: string;
  scramble: string | null;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  // Load the web component + create the element once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import("scramble-display");
      if (cancelled || !containerRef.current || elRef.current) return;
      const el = new mod.ScrambleDisplay();
      el.style.width = "100%";
      el.style.height = "100%";
      containerRef.current.appendChild(el);
      elRef.current = el;
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the element's attributes in sync with props.
  useEffect(() => {
    if (!ready || !elRef.current) return;
    elRef.current.event = event;
    elRef.current.scramble = scramble ?? "";
  }, [ready, event, scramble]);

  return <div ref={containerRef} className={className} aria-hidden />;
}
