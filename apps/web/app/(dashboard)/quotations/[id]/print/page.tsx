"use client";
import { visualizationSummary } from "@/lib/features/product-3d/catalog";
import { use, useEffect, useState } from "react";
import { BrandMark } from '@/components/brand/BrandMark';
import Image from "next/image";
import { Quotation } from "@/lib/features/quotations/types";
import { requestJson } from "@/lib/shared/network";
import { formatCurrency } from "@/lib/utils";
import { awningSummary } from "@/lib/features/awning/configuration";
import { ColorChip } from "@/components/colors/ColorSwatch";
import { ProductDrawing } from "@/components/drawing/ProductDrawing";
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
    <div className="quotation-print mx-auto max-w-4xl rounded-lg bg-white p-6 text-slate-800 sm:p-10">
      <style>{`@media print { header,nav,aside,.print-action,.rf-command-launcher,[data-ai-chatbot],.pwa-install-prompt { display:none!important } .rf-workspace { margin-left:0!important } .rf-workspace-main { padding:0!important } .quotation-print { margin:0;width:100%;max-width:none;color:#1e293b;background:white } .quote-item { break-inside:avoid } @page { size:A4;margin:15mm } }`}</style>
      <button
        className="rf-primary-button print-action mb-6"
        onClick={() => window.print()}
      >
        Yazdır / PDF olarak kaydet
      </button>
      <div className="flex items-center justify-between gap-5 border-b-2 border-slate-800 pb-6">
        <Image
          src="/images/winmax/renk-logo.webp"
          alt="Renk Alüminyum"
          width={150}
          height={69}
        />
        <div className="text-right">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[.2em] text-slate-500">TİCARİ TEKLİF</p>
          <h1 className="text-2xl font-semibold">Fiyat teklifi</h1>
          <p>{q.quotationNumber}{(q.revision ?? 1) > 1 ? ` · rev. ${q.revision}` : ""}</p>
          <p className="text-xs">
            {new Date(q.createdAt).toLocaleDateString("tr-TR")}
          </p>
        </div>
      </div>
      <div className="my-6 grid gap-4 rounded-md bg-slate-50 p-5 sm:grid-cols-2">
        <div><p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">SUNULAN FİRMA / MÜŞTERİ</p>
        <h2 className="text-lg font-medium">{q.customerName}</h2>
        </div><div className="space-y-1 text-sm sm:text-right"><p>Para birimi: <strong>{q.currency}</strong></p>
        {q.validUntil && <p className="text-xs">Geçerlilik: {q.validUntil}</p>}
        <p className="text-xs">{q.items.length} ürün kalemi</p></div>
      </div>
      {q.items.map((item, i) => (
        <section
          key={item.id || i}
          className="quote-item mb-6 border-b border-border pb-5"
        >
          <h3 className="font-semibold">
            {i + 1}. {item.productName}
          </h3>
          {item.productVisualization && <div className="my-3">{item.productVisualization.image && <Image src={item.productVisualization.image} alt="Kaydedilmiş 3D ürün görünümü" width={900} height={600} unoptimized className="max-h-64 w-full object-contain"/>}<p className="mt-2 text-xs">{visualizationSummary(item.productVisualization)}</p></div>}
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
          {item.productConfiguration?.parameters && (
            <ProductDrawing family={item.productConfiguration.family} widthMm={item.productConfiguration.parameters.widthMm} projectionMm={item.productConfiguration.parameters.projectionMm}
              heightMm={item.productConfiguration.parameters.mountingHeightMm} color={item.productConfiguration.color} className="my-3 h-auto max-h-60 w-full" />
          )}
          {item.color && !item.awningConfiguration && (
            <p className="my-2 text-sm">Renk: <ColorChip color={item.color} size={16} showName /></p>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-3 rounded-md border border-slate-200 p-3 text-sm sm:grid-cols-4">
            {[['Miktar',`${item.quantity} adet`],['Birim fiyat',formatCurrency(item.unitPrice,q.currency)],['Kalem indirimi',`%${item.discountPercent}`],['Kalem toplamı',formatCurrency(item.totalPrice,q.currency)]].map(([label,value])=><div key={label}><dt className="text-[10px] uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-medium tabular-nums">{value}</dd></div>)}
          </dl>
          {item.notes && <p className="mt-2 text-xs">{item.notes}</p>}
          {(item.awningConfiguration||item.productVisualization) && (
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
          <span>KDV %{q.vatPercent ?? 20}</span>
          <span>{formatCurrency(q.taxAmount, q.currency)}</span>
        </p>
        <p className="flex justify-between border-t border-border pt-3 font-bold">
          <span>Toplam</span>
          <span>{formatCurrency(q.totalAmount, q.currency)}</span>
        </p>
        {q.currency !== "TRY" && q.fxRate ? (
          <p className="flex justify-between text-xs">
            <span>1 {q.currency} = {q.fxRate} TL</span>
            <span>≈ {formatCurrency(q.totalAmount * q.fxRate, "TRY")}</span>
          </p>
        ) : null}
        {q.customerDecidedAt && q.status === "accepted" && (
          <p className="text-xs">Müşteri onayı: {q.customerDecisionName} · {new Date(q.customerDecidedAt).toLocaleString("tr-TR")}</p>
        )}
      </div>
      <div className="mt-8 whitespace-pre-wrap text-xs leading-6">
        {q.notes}
        {q.termsAndConditions && <p className="mt-4">{q.termsAndConditions}</p>}
        <div className="mt-6"><BrandMark href="/" size="sm" /></div>
      </div>
    </div>
  );
}
