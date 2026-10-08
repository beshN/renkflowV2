"use client";
import { use, useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Save, FileText } from "lucide-react";
import { AwningDialog } from "@/components/features/awning/AwningConfigurator";
import {
  applyAwning,
  awningSummary,
} from "@/lib/features/awning/configuration";
import {
  CreateQuotationInput,
  Quotation,
  QuotationItem,
  type ConversionResult,
} from "@/lib/features/quotations/types";
import { canEditQuotation } from "@/lib/features/quotations/permissions";
import { formatCurrency } from "@/lib/utils";
import { requestJson } from "@/lib/shared/network";
import { BomTables, ProductConfigurator } from "@/components/features/products/ProductConfigurator";
import { PRODUCT_FAMILIES } from "@/lib/features/products/families";
import { configuredLine, configurationSummary, unconfiguredLine, type ProductConfiguration } from "@/lib/features/products/configuration";

const emptyItem = (): QuotationItem => ({
  productName: "WINMAX Makaslı Tente",
  quantity: 1,
  unitPrice: 0,
  discountPercent: 0,
  totalPrice: 0,
});
export default function QuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const creationKey = useRef(crypto.randomUUID());
  const { id } = use(params),
    isNew = id === "new";
  const { data: session } = useSession();
  const [quotation, setQuotation] = useState<Quotation | null>(null),
    [loading, setLoading] = useState(!isNew),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [configuring, setConfiguring] = useState<{ index: number; family: string } | null>(null),
    [converted, setConverted] = useState<ConversionResult | null>(null);
  const [form, setForm] = useState<CreateQuotationInput>({
    customerName: "",
    currency: "TRY",
    discountPercent: 0,
    items: [emptyItem()],
  });
  const role = session?.user?.role as any,
    editable =
      (isNew || quotation?.status === "draft") && canEditQuotation(role);
  useEffect(() => {
    if (isNew || !session) return;
    const controller = new AbortController();
    requestJson<{ success: boolean; data: Quotation }>(
      `/api/v1/quotations/${id}`,
      { signal: controller.signal },
    )
      .then((r) => {
        if (controller.signal.aborted) return;
        if (r.ok && r.data?.data) {
          setError("");
          setQuotation(r.data.data);
          setForm({
            ...r.data.data,
            customerId: r.data.data.customerId || undefined,
            validUntil: r.data.data.validUntil || undefined,
            notes: r.data.data.notes || undefined,
            internalNotes: r.data.data.internalNotes || undefined,
            termsAndConditions: r.data.data.termsAndConditions || undefined,
          });
        } else setError(r.error || "Teklif alınamadı");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, isNew, session?.user?.tenantId, session?.user?.id]);
  function updateItem(index: number, key: keyof QuotationItem, value: unknown) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    }));
  }
  /** A configured product fills the line as the server will on save; a typed price is kept only when the matrix gave none. */
  function applyConfiguration(index: number, c: ProductConfiguration) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i !== index) return item;
        const wasMatrix = item.productConfiguration?.price?.source === "matrix";
        return configuredLine(item, c, wasMatrix ? 0 : item.unitPrice);
      }),
    }));
    setConfiguring(null);
  }
  async function save() {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const r = await requestJson<{ data: Quotation }>(
        isNew ? "/api/v1/quotations" : `/api/v1/quotations/${id}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            idempotencyKey: isNew ? creationKey.current : undefined,
            expectedVersion: quotation?.version,
          }),
        },
      );
      if (!r.ok || !r.data?.data)
        throw new Error(r.error || "Teklif kaydedilemedi");
      if (isNew) window.location.assign(`/quotations/${r.data.data.id}`);
      else {
        setQuotation(r.data.data);
        setMessage("Teklif kaydedildi.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem tamamlanamadı");
    } finally {
      setBusy(false);
    }
  }
  async function action(action: string, status?: string) {
    setBusy(true);
    setError("");
    try {
      const r = await requestJson<{ data: any }>(`/api/v1/quotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "convert"
            ? { action, expectedVersion: quotation?.version }
            : { status, expectedVersion: quotation?.version },
        ),
      });
      if (!r.ok || !r.data?.data)
        throw new Error(r.error || "İşlem tamamlanamadı");
      if (action === "convert") {
        const result = r.data.data as ConversionResult;
        // Lines whose work order could not be opened are said before leaving, with the reason.
        if (result.pendingWorkOrders?.length) {
          setConverted(result);
          // The quote is converted now: no longer editable or convertible on this page.
          setQuotation((prev) => (prev ? { ...prev, status: "converted", convertedToOrderId: result.orderId, version: prev.version + 1 } : prev));
        }
        else window.location.assign(`/orders/${result.orderId}`);
      } else setQuotation(r.data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem tamamlanamadı");
    } finally {
      setBusy(false);
    }
  }
  const subtotal = form.items.reduce(
      (sum, i) =>
        sum + i.quantity * i.unitPrice * (1 - i.discountPercent / 100),
      0,
    ),
    discount = (subtotal * form.discountPercent) / 100,
    total = (subtotal - discount) * 1.2;
  if (loading)
    return (
      <div className="rf-page" role="status">
        Teklif yükleniyor…
      </div>
    );
  return (
    <div className="rf-page space-y-6">
      <Link
        href="/quotations"
        className="inline-flex items-center gap-2 text-xs text-muted-foreground"
      >
        <ArrowLeft size={14} /> Tekliflere dön
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="rf-eyebrow">SATIŞ / TEKLİF</p>
          <h1 className="rf-page-title">
            {isNew ? "Yeni teklif" : quotation?.quotationNumber || "Teklif"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ölçü ve donanımı 3D hazırlayın, teklif fiyatını belirleyin.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isNew && (
            <Link
              className="rf-primary-button"
              href={`/quotations/${id}/print`}
            >
              <FileText size={15} /> Yazdır / PDF
            </Link>
          )}
          {editable && (
            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="rf-primary-button"
            >
              <Save size={15} />
              {busy ? "Kaydediliyor…" : "Teklifi kaydet"}
            </button>
          )}
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          {error}
        </div>
      )}
      {message && (
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
      )}
      {converted && (
        <section role="status" className="rf-panel space-y-2 text-sm">
          <p className="font-medium">
            Sipariş oluşturuldu. {converted.workOrders?.length ? `${converted.workOrders.length} kalemin üretim emri açıldı ve kesim havuzuna girdi. ` : ""}
            {converted.pendingWorkOrders!.length} kalem için üretim emri açılamadı:
          </p>
          <ul className="list-disc pl-5 text-amber-700 dark:text-amber-300">
            {converted.pendingWorkOrders!.map((p) => <li key={p.orderItemId}>{p.productName}: {p.reason}</li>)}
          </ul>
          <div className="flex gap-3">
            <Link className="underline" href={`/orders/${converted.orderId}`}>Siparişi aç</Link>
            <Link className="underline" href="/production">Üretim ekranı</Link>
          </div>
        </section>
      )}
      <section className="rf-panel grid gap-4 md:grid-cols-4">
        <label className="text-xs md:col-span-2">
          Müşteri / firma
          <input
            disabled={!editable}
            className="rf-input mt-2 w-full"
            value={form.customerName}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, customerName: e.target.value }))
            }
          />
        </label>
        <label className="text-xs">
          Geçerlilik tarihi
          <input
            disabled={!editable}
            type="date"
            className="rf-input mt-2 w-full"
            value={form.validUntil || ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                validUntil: e.target.value || undefined,
              }))
            }
          />
        </label>
        <label className="text-xs">
          Para birimi
          <select
            disabled={!editable}
            className="rf-input mt-2 w-full"
            value={form.currency}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, currency: e.target.value as any }))
            }
          >
            {["TRY", "EUR", "USD", "GBP"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </section>
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="rf-section-title">Teklif kalemleri</h2>
          {editable && (
            <button
              type="button"
              className="inline-flex items-center gap-2 text-xs text-primary"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  items: [...prev.items, emptyItem()],
                }))
              }
            >
              <Plus size={15} /> Kalem ekle
            </button>
          )}
        </div>
        {form.items.map((item, index) => (
          <article key={index} className="rf-panel space-y-4">
            <div className="flex items-center gap-3">
              <span className="rounded bg-muted px-2 py-1 text-xs tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <input
                aria-label={`Kalem ${index + 1} ürün adı`}
                disabled={!editable}
                value={item.productName}
                className="rf-input flex-1"
                onChange={(e) =>
                  updateItem(index, "productName", e.target.value)
                }
              />
              {editable && form.items.length > 1 && (
                <button
                  type="button"
                  className="rf-icon-button"
                  aria-label={`Kalem ${index + 1} sil`}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      items: prev.items.filter((_, i) => i !== index),
                    }))
                  }
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            {item.productConfiguration?.price && (
              <div className="space-y-2 rounded-md bg-muted p-3 text-xs leading-5">
                <p>{configurationSummary(item.productConfiguration as ProductConfiguration)}</p>
                {item.productConfiguration.price.source === "matrix" && item.productConfiguration.price.currency !== form.currency ? (
                  <p className="font-medium text-amber-700 dark:text-amber-300">
                    Para birimi değişti: matris fiyatı {item.productConfiguration.price.currency} içindi. Yeniden hesaplayın ya da birim fiyatı elle girin.
                  </p>
                ) : item.productConfiguration.price.source === "matrix" ? (
                  <p className="text-muted-foreground">Birim fiyat fiyat matrisinden.</p>
                ) : (
                  <p className="font-medium text-amber-700 dark:text-amber-300">
                    {item.productConfiguration.price.message}: birim fiyat elle girildi.
                  </p>
                )}
                <details>
                  <summary className="cursor-pointer">Malzeme ve kesim listesi</summary>
                  <div className="mt-2"><BomTables bom={(item.productConfiguration as ProductConfiguration).bom} /></div>
                </details>
              </div>
            )}
            {editable && configuring?.index === index && (
              <ProductConfigurator
                family={configuring.family}
                currency={form.currency}
                initial={item.productConfiguration?.family === configuring.family ? item.productConfiguration : undefined}
                onApply={(c) => applyConfiguration(index, c)}
                onClose={() => setConfiguring(null)}
              />
            )}
            {editable && configuring?.index !== index && (
              <div className="flex flex-wrap gap-2">
                {PRODUCT_FAMILIES.map((f) => (
                  <button key={f.key} type="button" className="rf-secondary-button" onClick={() => setConfiguring({ index, family: f.key })}>
                    {item.productConfiguration?.family === f.key ? `${f.label} yapılandırmasını değiştir` : `${f.label} yapılandır`}
                  </button>
                ))}
                {item.productConfiguration && (
                  <button type="button" className="rf-secondary-button" onClick={() => setForm((prev) => ({ ...prev, items: prev.items.map((entry, i) => (i === index ? unconfiguredLine(entry) : entry)) }))}>Yapılandırmayı kaldır</button>
                )}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-4">
              {(
                [
                  ["quantity", "Adet"],
                  ["unitPrice", "Birim fiyat"],
                  ["discountPercent", "Kalem indirimi (%)"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="text-xs">
                  {label}
                  <input
                    // A matrix price is set by the server; only an unpriced configuration takes a typed price.
                    disabled={!editable || (key === "unitPrice" && item.productConfiguration?.price?.source === "matrix" && item.productConfiguration.price.currency === form.currency)}
                    type="number"
                    min={key === "quantity" ? 1 : 0}
                    max={key === "discountPercent" ? 100 : undefined}
                    step={key === "quantity" ? 1 : 0.01}
                    className="rf-input mt-2 w-full"
                    value={item[key]}
                    onChange={(e) =>
                      updateItem(index, key, Number(e.target.value))
                    }
                  />
                </label>
              ))}
              <div className="text-xs">
                Kalem toplamı
                <p className="mt-3 font-semibold tabular-nums">
                  {formatCurrency(
                    item.quantity *
                      item.unitPrice *
                      (1 - item.discountPercent / 100),
                    form.currency,
                  )}
                </p>
              </div>
            </div>
            {item.awningConfiguration && (
              <p className="rounded-md bg-muted p-3 text-xs leading-5">
                {awningSummary(item.awningConfiguration)}
              </p>
            )}
            {!item.productConfiguration && <div className="flex flex-wrap items-center gap-3">
              <AwningDialog
                configuration={item.awningConfiguration}
                previewImage={item.awningPreview}
                readOnly={!editable}
                label={editable ? "3D yapılandır" : "3D görünüm"}
                onApply={(c, image) =>
                  setForm((prev) => ({
                    ...prev,
                    items: prev.items.map((entry, i) =>
                      i === index ? applyAwning(entry, c, image) : entry,
                    ),
                  }))
                }
              />
              <span className="text-[11px] text-muted-foreground">
                Teklif fiyatını satış çalışanı belirler.
              </span>
            </div>}
            <label className="block text-xs">
              Kalem notu
              <input
                disabled={!editable}
                className="rf-input mt-2 w-full"
                value={item.notes || ""}
                onChange={(e) => updateItem(index, "notes", e.target.value)}
              />
            </label>
          </article>
        ))}
      </section>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="rf-panel space-y-4">
          <label className="block text-xs">
            Teklif notları
            <textarea
              disabled={!editable}
              className="rf-input mt-2 min-h-24 w-full"
              value={form.notes || ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
          </label>
          <label className="block text-xs">
            Ödeme, teslimat ve montaj koşulları
            <textarea
              disabled={!editable}
              className="rf-input mt-2 min-h-24 w-full"
              value={form.termsAndConditions || ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  termsAndConditions: e.target.value,
                }))
              }
            />
          </label>
        </section>
        <section className="rf-panel space-y-3 text-sm">
          <p className="flex justify-between">
            <span>Ara toplam</span>
            <span>{formatCurrency(subtotal, form.currency)}</span>
          </p>
          <label className="flex items-center justify-between gap-3 text-xs">
            Genel indirim (%)
            <input
              disabled={!editable}
              type="number"
              min={0}
              max={100}
              value={form.discountPercent}
              className="rf-input w-24"
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  discountPercent: +e.target.value,
                }))
              }
            />
          </label>
          <p className="flex justify-between text-muted-foreground">
            <span>KDV (%20)</span>
            <span>
              {formatCurrency((subtotal - discount) * 0.2, form.currency)}
            </span>
          </p>
          <p className="flex justify-between border-t border-border pt-4 font-semibold">
            <span>Genel toplam</span>
            <span>{formatCurrency(total, form.currency)}</span>
          </p>
        </section>
      </div>
      {!isNew && canEditQuotation(role) && (
        <section className="rf-panel flex flex-wrap items-center gap-3">
          <span className="mr-auto text-xs text-muted-foreground">
            Durum:{" "}
            {
              (
                {
                  draft: "Taslak",
                  sent: "Gönderildi",
                  accepted: "Kabul edildi",
                  rejected: "Reddedildi",
                  expired: "Süresi doldu",
                  converted: "Siparişe dönüştü",
                } as any
              )[quotation?.status || "draft"]
            }
          </span>
          {quotation?.status === "draft" && (
            <button
              disabled={busy}
              className="rf-primary-button"
              onClick={() => action("status", "sent")}
            >
              Gönderildi olarak işaretle
            </button>
          )}
          {quotation?.status === "sent" && (
            <>
              <button
                disabled={busy}
                className="rf-primary-button"
                onClick={() => action("status", "accepted")}
              >
                Kabul edildi
              </button>
              <button
                disabled={busy}
                className="rf-input"
                onClick={() => action("status", "rejected")}
              >
                Reddedildi
              </button>
            </>
          )}
          {["draft", "sent", "accepted"].includes(quotation?.status || "") && (
            <button
              disabled={busy}
              className="rf-primary-button"
              onClick={() => action("convert")}
            >
              Siparişe dönüştür
            </button>
          )}
          {quotation?.convertedToOrderId && (
            <Link
              href={`/orders/${quotation.convertedToOrderId}`}
              className="text-sm text-primary"
            >
              Siparişi aç →
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
