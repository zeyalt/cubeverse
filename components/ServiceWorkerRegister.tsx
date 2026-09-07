"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;

    const announceUpdate = () => {
      window.dispatchEvent(new CustomEvent("cubeverse:service-worker-update"));
    };

    const watchInstallingWorker = (worker: ServiceWorker | null) => {
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          announceUpdate();
        }
      });
    };

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        if (disposed) return;

        if (registration.waiting) announceUpdate();
        watchInstallingWorker(registration.installing);
        registration.addEventListener("updatefound", () => {
          watchInstallingWorker(registration?.installing ?? null);
        });
      } catch (error) {
        console.error("[service-worker] registration failed:", error);
      }
    };

    const checkForUpdate = () => {
      if (document.visibilityState === "visible") {
        registration?.update().catch((error) => {
          console.error("[service-worker] update check failed:", error);
        });
      }
    };

    void register();
    window.addEventListener("online", checkForUpdate);
    document.addEventListener("visibilitychange", checkForUpdate);
    const interval = window.setInterval(checkForUpdate, 60 * 60_000);

    return () => {
      disposed = true;
      window.removeEventListener("online", checkForUpdate);
      document.removeEventListener("visibilitychange", checkForUpdate);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
