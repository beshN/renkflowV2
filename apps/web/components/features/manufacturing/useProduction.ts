"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { requestJson } from "@/lib/shared/network";
import {
  pendingOperations,
  productionDeviceDb,
  queueOperation,
  syncOperations,
  PendingCommand,
} from "@/lib/features/manufacturing/offline";
export function useProduction() {
  const { data: session } = useSession(),
    scope =
      session?.user?.tenantId && session.user.id
        ? `${session.user.tenantId}-${session.user.id}`
        : "",
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<PendingCommand[]>([]),
    syncing = useRef(false),
    refreshSequence = useRef(0),
    refreshController = useRef<AbortController | null>(null),
    activeScope = useRef(scope),
    commandLock = useRef(false),
    retryCommand = useRef<{scope:string;hash:string;id:string}|null>(null);
  activeScope.current = scope;
  const refresh = useCallback(async () => {
    if (!scope) return;
    const sequence = ++refreshSequence.current;
    refreshController.current?.abort();
    const controller = new AbortController();
    refreshController.current = controller;
    const result = await requestJson<{ data: any }>("/api/v1/production", {
      cache: "no-store",
      signal: controller.signal,
    });
    if (
      sequence !== refreshSequence.current ||
      activeScope.current !== scope ||
      controller.signal.aborted
    )
      return;
    if (result.ok && result.data) {
      setData(result.data.data);
      setError("");
      const db = await productionDeviceDb(scope);
      await db.put("cache", result.data.data, "overview");
    } else {
      const db = await productionDeviceDb(scope);
      const cache = await db.get("cache", "overview");
      if ([401, 403].includes(result.status)) {
        await db.delete("cache", "overview");
        setData(null);
      } else if (result.status === 0 && cache) setData(cache);
      setError(result.error || "Üretim alınamadı");
    }
  }, [scope]);
  const refreshPending = useCallback(async () => {
    if (scope) setPending(await pendingOperations(scope));
  }, [scope]);
  const sync = useCallback(async () => {
    if (!scope || syncing.current) return;
    syncing.current = true;
    try {
      await syncOperations(scope, () => {
        void refreshPending();
      });
      await refresh();
      await refreshPending();
    } finally {
      syncing.current = false;
    }
  }, [scope, refresh, refreshPending]);
  useEffect(() => {
    setData(null);
    setPending([]);
    void refresh();
    void refreshPending();
    if (!scope) return;
    const events = new EventSource("/api/v1/production/events");
    let updateTimer: ReturnType<typeof setTimeout> | undefined;
    events.addEventListener("update", () => {
      clearTimeout(updateTimer);
      updateTimer = setTimeout(() => void refresh(), 200);
    });
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void sync();
    }, 20000);
    window.addEventListener("online", sync);
    return () => {
      events.close();
      clearTimeout(updateTimer);
      refreshController.current?.abort();
      clearInterval(timer);
      window.removeEventListener("online", sync);
    };
  }, [scope, refresh, refreshPending, sync]);
  async function command(action: string, payload: Record<string, unknown>) {
    if(commandLock.current)throw new Error("Önceki işlem sunucu onayını bekliyor");
    commandLock.current=true;
    const hash=JSON.stringify({action,data:payload});
    if(retryCommand.current?.scope!==scope || retryCommand.current?.hash!==hash)retryCommand.current={scope,hash,id:crypto.randomUUID()};
    const requestId=retryCommand.current.id;
    setBusy(true);
    setError("");
    try {
      const result = await requestJson<{ data: any }>("/api/v1/production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commandId: requestId,
          action,
          data: payload,
        }),
      });
      if (!result.ok) throw new Error(result.error || "İşlem kabul edilmedi");
      retryCommand.current=null;
      await refresh();
      return result.data?.data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem tamamlanamadı");
      throw e;
    } finally {
      commandLock.current=false;
      setBusy(false);
    }
  }
  async function queueCommand(action: PendingCommand["action"],
    payload: Record<string, unknown>,
    photos?: PendingCommand["photos"],
  ) {
    if (!scope) return;
    await queueOperation(scope, {
      commandId: crypto.randomUUID(),
      action,
      data: payload,
      photos,
      createdAt: new Date().toISOString(),
      status: "pending",
    });
    await refreshPending();
    await sync();
  }
  const operate=(payload:Record<string,unknown>,photos?:PendingCommand["photos"])=>queueCommand("operation",payload,photos);
  return { data, error, busy, command, refresh, operate, queueCommand, pending, scope, sync };
}
