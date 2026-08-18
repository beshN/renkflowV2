"use client";

import { LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AnalysisStatus } from "@/lib/types";

const analysisCopy: Partial<Record<AnalysisStatus, { title: string; description: string }>> = {
  queued: {
    title: "PDF analiz sırasına alındı",
    description: "Dosya güvenli iş akışına aktarıldı. Bu ekran sonuç hazır olduğunda kendiliğinden yenilenir.",
  },
  running: {
    title: "PDF alanları çıkarılıyor",
    description: "Müşteri, ölçü ve üretim alanları okunuyor. Sipariş ancak ofis onayından sonra ilerler.",
  },
  failed: {
    title: "PDF analizi tamamlanamadı",
    description: "Dosya korunuyor. Sorun giderildikten sonra aynı PDF için analizi yeniden başlatabilirsiniz.",
  },
};

export function AnalysisStatusCard({
  analysisId,
  status,
  errorMessage,
}: {
  analysisId: string;
  status: AnalysisStatus;
  errorMessage?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [retryError, setRetryError] = useState("");
  const copy = analysisCopy[status];

  useEffect(() => {
    if (status !== "queued" && status !== "running") return;

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 4000);

    return () => window.clearInterval(interval);
  }, [router, status]);

  if (!copy) return null;

  const handleRetry = () => startTransition(async () => {
    setRetryError("");
    try {
      const response = await fetch(`/api/analyses/${analysisId}/retry`, { method: "POST" });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Analiz yeniden başlatılamadı.");
      router.refresh();
    } catch (cause) {
      setRetryError(cause instanceof Error ? cause.message : "Analiz yeniden başlatılamadı.");
    }
  });

  const isActive = status === "queued" || status === "running";
  return (
    <div className={`analysis-progress-card analysis-progress-${status}`} role="status" aria-live="polite">
      {isActive ? <LoaderCircle className="analysis-spinner" aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
      <div>
        <b>{copy.title}</b>
        <p>{copy.description}</p>
        {status === "failed" && errorMessage ? <small>{errorMessage.slice(0, 300)}</small> : null}
        {retryError ? <small className="inline-error" role="alert">{retryError}</small> : null}
      </div>
      {status === "failed" ? (
        <button type="button" className="small-action" disabled={pending} onClick={handleRetry}>
          <RotateCcw size={13} aria-hidden="true" />
          {pending ? "Başlatılıyor…" : "Tekrar dene"}
        </button>
      ) : null}
    </div>
  );
}
