"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { cancelOrder } from "@/app/actions/core";

export function CancelOrderAction({ organizationId, orderId }: { organizationId: string; orderId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleCancel = () => startTransition(async () => {
    setError("");
    try {
      await cancelOrder({ organizationId, orderId });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sipariş iptal edilemedi.");
    }
  });

  if (!confirming) {
    return <button type="button" className="danger-action" onClick={() => setConfirming(true)}><Ban size={14} />Siparişi iptal et</button>;
  }

  return (
    <div className="cancel-confirm" role="group" aria-label="Sipariş iptal onayı">
      <span>Bu sipariş üretime alınmayacak.</span>
      <button type="button" className="danger-action" disabled={pending} onClick={handleCancel}>{pending ? "İptal ediliyor…" : "İptali onayla"}</button>
      <button type="button" className="small-action" disabled={pending} onClick={() => setConfirming(false)}>Vazgeç</button>
      {error ? <small className="inline-error" role="alert">{error}</small> : null}
    </div>
  );
}
