"use client";

import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

/**
 * Kid-mode theme. The choice is persisted in localStorage and reflected by a
 * `theme-light` / `theme-dark` class on <html>, which the kid-mode CSS tokens
 * key off. A blocking script in the root layout applies the stored theme before
 * first paint to avoid a flash, so this hook only needs to read/sync afterwards.
 */
function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("theme-light") ? "light" : "dark";
}

export function useTheme() {
  // Read the real theme synchronously on the first client render (the layout's
  // blocking script already set the html class), so theme-dependent rendering
  // such as charts gets the correct colours immediately — no dark→light flip.
  const [theme, setThemeState] = useState<Theme>(currentTheme);

  // Safety re-sync after mount in case the class changed between render and mount.
  useEffect(() => {
    const t = currentTheme();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState((prev) => (prev === t ? prev : t));
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem("theme", t);
    const root = document.documentElement;
    root.classList.toggle("theme-light", t === "light");
    root.classList.toggle("theme-dark", t !== "light");
  }

  return { theme, setTheme };
}
