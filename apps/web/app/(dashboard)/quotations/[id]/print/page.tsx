"use client";
import { use, useEffect, useState } from "react";
import { useAuth } from '@/lib/context/AuthContext';
import { QuotationDocument } from '@/components/sales/QuotationDocument';
import { Quotation } from "@/lib/features/quotations/types";
import { requestJson } from "@/lib/shared/network";
export default function QuotationPrint({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const [q, setQ] = useState<Quotation | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    requestJson<{ data: Quotation }>(`/api/v1/quotations/${id}`, {
      signal: c.signal,
    }).then((r) => {
      if (c.signal.aborted) return;
      if (r.ok && r.data?.data) {
        setQ(r.data.data);
        setError("");
      } else setError(r.error || "Teklif alınamadı");
    });
    return () => c.abort();
  }, [id]);
  if (error)
    return (
      <p role="alert" className="rf-page">
        {error}
      </p>
    );
  if (!q)
    return (
      <p role="status" className="rf-page">
        Teklif hazırlanıyor…
      </p>
    );
  return <div className="p-4 sm:p-6 print:p-0">
    <div className="print-action mx-auto mb-5 flex max-w-[850px] items-center justify-between gap-4">
      <a href={`/quotations/${id}`} className="rf-secondary-button">Teklife dön</a>
      <button className="rf-primary-button" onClick={() => window.print()}>Yazdır / PDF olarak kaydet</button>
    </div>
    <QuotationDocument quote={q} firmName={user?.tenantName} logoUrl={user?.logoUrl} />
  </div>;
}
