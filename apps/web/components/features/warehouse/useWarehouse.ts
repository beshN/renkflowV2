"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/context/AuthContext";
export function useWarehouse() {
  const { user } = useAuth();
  const scope =
    user?.tenantId && user?.id
      ? user.tenantId + ":" + user.id + ":" + user.role
      : "";
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const [snapshot, setSnapshot] = useState<{ scope: string; data: any } | null>(
    null,
  );
  const data = snapshot?.scope === scope ? snapshot.data : null;
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(true);
  const pending = useRef<{ signature: string; body: any } | null>(null);
  const refresh = useCallback(async () => {
    if (!scope) return;
    try {
      const r = await fetch("/api/v1/warehouse", { cache: "no-store" });
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      if (scopeRef.current !== scope) return;
      if (
        b.data.actor.tenantId !== user?.tenantId ||
        b.data.actor.userId !== user?.id
      )
        throw Error("Oturum değişti. Sayfayı yenileyin.");
      setSnapshot({ scope, data: b.data });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Depo yüklenemedi");
    }
  }, [scope, user?.tenantId, user?.id]);
  useEffect(() => {
    pending.current = null;
    void refresh();
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [refresh]);
  const command = useCallback(
    async (action: string, values: any) => {
      if (!scope || scopeRef.current !== scope)
        throw Error("Oturumunuzu yenileyin.");
      if (!navigator.onLine)
        throw Error(
          "Bu stok işlemi için bağlantı gerekli. Sayım ve transferi bağlantı geldiğinde onaylayın.",
        );
      const signature = JSON.stringify([action, values]);
      if (pending.current && pending.current.signature !== signature)
        throw Error(
          "Önce sonucu belirsiz olan işlemi aynı bilgilerle tekrar deneyin.",
        );
      if (!pending.current)
        pending.current = {
          signature,
          body: {
            commandId: crypto.randomUUID(),
            action: "warehouse." + action,
            data: values,
          },
        };
      setBusy(true);
      try {
        const r = await fetch("/api/v1/warehouse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pending.current.body),
        });
        const b = await r.json();
        if (!r.ok) {
          if (r.status < 500) pending.current = null;
          throw Error(b.error || "İşlem tamamlanamadı");
        }
        pending.current = null;
        await refresh();
        return b.data;
      } finally {
        setBusy(false);
      }
    },
    [refresh, scope],
  );
  return { data, error, busy, online, refresh, command };
}
