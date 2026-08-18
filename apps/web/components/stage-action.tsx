"use client";

import { useState, useTransition } from "react";
import { advanceOrderStage, activateRuleSet, runCalculation } from "@/app/actions/core";
import { useRouter } from "next/navigation";

export function StageAction({ organizationId, orderId, stageId, eventType = "started", label }: { organizationId: string; orderId: string; stageId: string; eventType?: "started" | "completed"; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  const handleClick = () => startTransition(async () => {
    setError("");
    try {
      await advanceOrderStage({ organizationId, orderId, stageId, eventType, note: "" });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Üretim aşaması güncellenemedi.");
    }
  });

  return (
    <div className="stage-action">
      <button type="button" className="small-action" disabled={pending} onClick={handleClick}>
        {pending ? "İşleniyor…" : label}
      </button>
      {error ? <small className="inline-error" role="alert">{error}</small> : null}
    </div>
  );
}

export function ActivateRuleAction({ organizationId, ruleSetId }: { organizationId: string; ruleSetId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  return <div><button className="small-action" disabled={pending} onClick={() => startTransition(async () => {
    try {
      await activateRuleSet({ organizationId, ruleSetId });
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "İşlem başarısız."); }
  })}>{pending ? "Etkinleştiriliyor…" : "Etkinleştir"}</button>{error && <small className="inline-error">{error}</small>}</div>;
}

export function CalculationAction({ organizationId, orderId }: { organizationId: string; orderId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  return <div><button className="small-action" disabled={pending} onClick={() => startTransition(async () => {
    try {
      await runCalculation({ organizationId, orderId });
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Hesaplama başarısız."); }
  })}>{pending ? "Hesaplanıyor…" : "Hesap motorunu çalıştır"}</button>{error && <small className="inline-error">{error}</small>}</div>;
}
