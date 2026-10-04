"use client";
import { use, useEffect, useState } from "react";
import Image from "next/image";
import { Quotation } from "@/lib/features/quotations/types";
import { requestJson } from "@/lib/shared/network";
import { formatCurrency } from "@/lib/utils";
import { awningSummary } from "@/lib/features/awning/configuration";
export default function QuotationPrint({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
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
  return (
    <div className="quotation-print mx-auto max-w-4xl p-6">
      <style>{`@media print { header,nav,aside,.print-action,.rf-command-launcher,[data-ai-chatbot],.pwa-install-prompt { display:none!important } .rf-workspace { margin-left:0!important } .rf-workspace-main { padding:0!important } .quotation-print { margin:0;width:100%;max-width:none;color:#1e293b;background:white } .quote-item { break-inside:avoid } @page { size:A4;margin:15mm } }`}</style>
      <button
        className="rf-primary-button print-action mb-6"
        onClick={() => window.print()}
      >
        Yazdır / PDF olarak kaydet
      </button>
      <div className="flex items-center justify-between border-b border-border pb-5">
        <Image
          src="/images/winmax/renk-logo.webp"
          alt="Renk Alüminyum"
          width={150}
          height={69}
        />
        <div className="text-right">
          <h1 className="text-xl font-semibold">Fiyat teklifi</h1>
          <p>{q.quotationNumber}</p>
          <p className="text-xs">
            {new Date(q.createdAt).toLocaleDateString("tr-TR")}
          </p>
        </div>
      </div>
      <div className="my-6">
        <h2 className="text-lg font-medium">{q.customerName}</h2>
        {q.validUntil && <p className="text-xs">Geçerlilik: {q.validUntil}</p>}
      </div>
      {q.items.map((item, i) => (
        <section
          key={item.id || i}
          className="quote-item mb-6 border-b border-border pb-5"
        >
          <h3 className="font-semibold">
            {i + 1}. {item.productName}
          </h3>
          {item.awningPreview && (
            <Image
              src={item.awningPreview}
              alt="Temsili 3D tente görünümü"
              width={900}
              height={470}
              unoptimized
              className="my-3 max-h-64 w-full object-contain"
            />
          )}
          {item.awningConfiguration && (
            <p className="my-3 text-xs leading-5">
              {awningSummary(item.awningConfiguration)}
            </p>
          )}
          <p className="text-sm">
            {item.quantity} adet × {formatCurrency(item.unitPrice, q.currency)}{" "}
            · İndirim %{item.discountPercent} ·{" "}
            <strong>{formatCurrency(item.totalPrice, q.currency)}</strong>
          </p>
          {item.notes && <p className="mt-2 text-xs">{item.notes}</p>}
          {item.awningConfiguration && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Temsili 3D görünüm; teknik uygulama çizimi değildir.
            </p>
          )}
        </section>
      ))}
      <div className="ml-auto max-w-xs space-y-2 text-sm">
        <p className="flex justify-between">
          <span>Ara toplam</span>
          <span>{formatCurrency(q.subtotal, q.currency)}</span>
        </p>
        <p className="flex justify-between">
          <span>İndirim</span>
          <span>{formatCurrency(q.discountAmount, q.currency)}</span>
        </p>
        <p className="flex justify-between">
          <span>KDV</span>
          <span>{formatCurrency(q.taxAmount, q.currency)}</span>
        </p>
        <p className="flex justify-between border-t border-border pt-3 font-bold">
          <span>Toplam</span>
          <span>{formatCurrency(q.totalAmount, q.currency)}</span>
        </p>
      </div>
      <div className="mt-8 whitespace-pre-wrap text-xs leading-6">
        {q.notes}
        {q.termsAndConditions && <p className="mt-4">{q.termsAndConditions}</p>}
      </div>
    </div>
  );
}
