"use client";
import { useState } from "react";
import { useMemberAccess } from "@/lib/hooks/useMemberAccess";
export function ZplDownload({ kind, id }: { kind: "cut" | "job" | "shipment" | "location"; id: string }) {
  const access = useMemberAccess();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const module = kind === "location" ? "inventory" : "production";
  if (!access || !["owner", "admin", "office"].includes(access.base) || !access.permissions[module]?.includes("view") || (kind === "shipment" && access.hidden.includes("customer_contact"))) return null;
  async function download() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/v1/labels/zpl?kind=${kind}&id=${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error || "ZPL hazırlanamadı"); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = `${kind}-${id}.zpl`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : "ZPL indirilemedi"); }
    finally { setBusy(false); }
  }
  return <span className="inline-flex flex-col items-start gap-1 print:hidden">
    <button type="button" className="rf-input text-xs" disabled={busy} onClick={download}>{busy ? "ZPL hazırlanıyor…" : "ZPL indir"}</button>
    {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
  </span>;
}
