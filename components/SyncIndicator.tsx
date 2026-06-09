"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Cloud, CloudOff, Loader2 } from "lucide-react";
import { getPendingCount } from "@/lib/offline/queue";
import { syncPendingSolves } from "@/lib/offline/sync";

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function SyncIndicator() {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  );
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refresh = useCallback(() => {
    getPendingCount()
      .then(setPending)
      .catch(() => setPending(0));
  }, []);

  const doSync = useCallback(() => {
    if (!navigator.onLine || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    syncPendingSolves()
      .then(() => getPendingCount())
      .then(setPending)
      .catch(() => setPending(0))
      .finally(() => {
        syncingRef.current = false;
        setSyncing(false);
      });
  }, []);

  useEffect(() => {
    const onOnline = () => doSync();
    window.addEventListener("online", onOnline);
    const poll = setInterval(refresh, 5000);
    const init = setTimeout(refresh, 0);
    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(poll);
      clearTimeout(init);
    };
  }, [refresh, doSync]);

  if (online && pending === 0) return null;

  return (
    <div
      className={`flex items-center gap-1 rounded-md border-2 border-black px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
        online ? "bg-[#FFD500] text-[#1A1200]" : "bg-[#B71234] text-white"
      }`}
      style={{ boxShadow: "2px 2px 0 #0A0A0A" }}
    >
      {syncing ? (
        <Loader2 className="size-3 animate-spin" />
      ) : online ? (
        <Cloud className="size-3" />
      ) : (
        <CloudOff className="size-3" />
      )}
      {syncing ? "Sync" : online ? `${pending}` : "Off"}
    </div>
  );
}
