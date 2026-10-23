"use client";
import { use, useState } from "react";
import Link from "next/link";
import { intakeReviewFields, ExtractionEvidence } from "@/lib/ai/extraction";
import { missingInfoMessage } from "@/lib/ai/extract/missing-info";
import useSWR from "swr";
import LazyPDFViewer from "@/components/features/pdf-viewer/LazyPDFViewer";
import { ProductDialog } from "@/components/features/product-3d/ProductDialog";
import { attachVisualization } from "@/lib/features/product-3d/catalog";
import { applyAwning } from "@/lib/features/awning/configuration";
const fieldLabels: Record<string, string> = {
  customerName: "Müşteri",
  productName: "Ürün",
  quantity: "Adet",
  widthMm: "En",
  projectionMm: "Açılım",
  mountingHeightMm: "Montaj yüksekliği",
  heightMm: "Ürün yüksekliği",
  color: "Gövde rengi",
  motorType: "Motor",
  ledType: "LED",
  fabricType: "Kumaş",
  deliveryDate: "Teslim tarihi",
  email: "E-posta",
  phone: "Telefon",
};
/** What the customer still has to tell us, as a message to copy and send. */
function AskCustomer({ message }: { message: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="rf-panel space-y-2">
      <h2 className="rf-section-title">Müşteriye sorulacaklar</h2>
      <p className="text-xs text-muted-foreground">Taslakta eksik bilgi var. Mesajı kopyalayıp müşteriye kendiniz gönderin.</p>
      <textarea readOnly rows={Math.min(14, message.split("\n").length + 1)} className="w-full rounded border bg-transparent p-2 text-xs" value={message} />
      <button
        type="button"
        className="rf-secondary-button min-h-8 text-xs"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(message);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // No clipboard permission: the text is selectable above.
          }
        }}
      >
        {copied ? "Kopyalandı" : "Mesajı kopyala"}
      </button>
    </section>
  );
}
function Review({ draft, onSource }: { draft: any; onSource: (page: number) => void }) {
  const d = draft.extracted_data,
    [form, setForm] = useState<any>({
      customerName: d.customerName || "",
      email: d.email || "",
      phone: d.phone || "",
      deliveryDate: d.deliveryDate || "",
      notes: d.notes || "",
      currency: "TRY",
      version: draft.review_version || 1,
      reviewedFields: [],
      items: (d.items || []).map((i: any, sourceIndex: number) => ({
        sourceIndex,
        ...i,
        quantityUnit: i.unit || "adet",
        customParameters: Array.isArray(i.customParameters) ? Object.fromEntries(i.customParameters.filter((p: any) => p.value !== null).map((p: any) => [p.key, p.value])) : i.customParameters || {},
        productName: i.productName || "",
        quantity: i.quantity || 0,
        widthMm: i.widthMm ?? undefined,
        heightMm: i.heightMm ?? undefined,
        projectionMm: i.projectionMm ?? undefined,
        mountingHeightMm: i.mountingHeightMm ?? undefined,
        motorType: i.motorType ?? undefined,
        ledType: i.ledType ?? undefined,
        fabricType: i.fabricType ?? undefined,
        color: i.color ?? undefined,
        notes: i.notes ?? undefined,
        unitPrice: 0,
        totalPrice: 0,
      })),
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (draft.status === "approved")
    return (
      <div className="rf-panel">
        <p>Sipariş oluşturuldu.</p>
        <Link
          href={`/orders/${draft.order_id}`}
          className="mt-3 inline-block text-primary"
        >
          Siparişi aç →
        </Link>
      </div>
    );
  function itemField(index: number, key: string, value: unknown) {
    setForm((p: any) => ({
      ...p,
      items: p.items.map((i: any, n: number) =>
        n === index ? { ...i, [key]: value } : i,
      ),
    }));
  }
  const requiredReview = intakeReviewFields(d);
  function evidence(field: string, index?: number) {
    const row: ExtractionEvidence | undefined = (index === undefined ? d.fieldEvidence : d.items[form.items[index]?.sourceIndex]?.fieldEvidence)?.find((e: ExtractionEvidence) => e.field === field);
    if (!row) return null;
    return <span className="mt-2 block text-xs text-muted-foreground">
      {row.confidence !== null && `Model güveni: %${Math.round(row.confidence * 100)} · `}
      {row.sourceText || "Belgede açık kanıt bulunamadı"}
      {row.sourcePage && <button type="button" className="ml-2 text-primary underline" onClick={() => onSource(row.sourcePage!)}>Sayfa {row.sourcePage}</button>}
    </span>;
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const payload = {
            ...form,
            deliveryDate: form.deliveryDate || undefined,
            items: form.items.map((i: any) => ({
              ...i,
              totalPrice: i.quantity * i.unitPrice,
            })),
          };
          const r = await fetch(`/api/v1/production/intake/${draft.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const body = await r.json();
          if (!r.ok) throw new Error(body.error);
          window.location.assign(`/orders/${body.data.orderId}`);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Onaylanamadı");
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-4"
    >
      {missingInfoMessage(d) && <AskCustomer message={missingInfoMessage(d)!} />}
      <section className="rf-panel space-y-4">
        <h2 className="rf-section-title">Alanları belgeyle karşılaştırın</h2>
        {(draft.warnings || []).map((w: string, i: number) => (
          <p key={i} className="rounded bg-amber-500/10 p-3 text-xs">
            {w}
          </p>
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["customerName", "Müşteri / firma"],
            ["email", "E-posta"],
            ["phone", "Telefon"],
            ["deliveryDate", "Teslim tarihi"],
          ].map(([key, label]) => (
            <label key={key} className="text-xs">
              {label}
              <input
                required={key === "customerName"}
                type={
                  key === "deliveryDate"
                    ? "date"
                    : key === "email"
                      ? "email"
                      : "text"
                }
                className="rf-input mt-2 w-full"
                aria-invalid={requiredReview.includes(key) && !form.reviewedFields.includes(key)}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
              {evidence(key)}
            </label>
          ))}
        </div>
      </section>
      {form.items.map((item: any, index: number) => (
        <section key={index} className="rf-panel space-y-4">
          <div className="flex justify-between"><h2 className="text-sm font-semibold">Kalem {index + 1}</h2><button type="button" className="text-xs text-destructive" onClick={() => setForm((p: any) => ({...p, items:p.items.filter((_: any,n: number) => n !== index)}))}>Kalemi kaldır</button></div>
          {item.uncertainFields?.length > 0 && (
            <p className="rounded bg-amber-500/10 p-3 text-xs">
              Kontrol gerekli:{" "}
              {item.uncertainFields
                .map(
                  (key: string) => fieldLabels[key] || "Belgedeki eksik bilgi",
                )
                .join(", ")}
            </p>
          )}
          <blockquote className="border-l-2 border-border pl-3 text-xs leading-6 text-muted-foreground">
            {item.evidence} {item.sourcePage && `· Sayfa ${item.sourcePage}`}
          </blockquote>
          <label className="block text-xs">
            Ürün adı
            <input
              required
              className="rf-input mt-2 w-full"
              value={item.productName}
              onChange={(e) => itemField(index, "productName", e.target.value)}
            />
            {evidence("productName", index)}
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["quantity", "Adet"],
              ["unitPrice", "Birim fiyat"],
              ["widthMm", "En · mm"],
              ["projectionMm", "Açılım · mm"],
              ["mountingHeightMm", "Montaj yüksekliği · mm"],
              ["heightMm", "Belgedeki ürün yüksekliği · mm"],
            ].map(([key, label]) => (
              <label key={key} className="text-xs">
                {label}
                <input
                  required={["quantity", "unitPrice"].includes(key)}
                  disabled={
                    !!item.awningConfiguration &&
                    ["widthMm", "projectionMm", "mountingHeightMm"].includes(
                      key,
                    )
                  }
                  type="number"
                  min={key === "unitPrice" ? 0 : 1}
                  step="any"
                  className="rf-input mt-2 w-full"
                  aria-invalid={requiredReview.includes(`items.${item.sourceIndex ?? index}.${key}`) && !form.reviewedFields.includes(`items.${item.sourceIndex ?? index}.${key}`)}
                  value={item[key] ?? ""}
                  onChange={(e) =>
                    itemField(
                      index,
                      key,
                      e.target.value ? Number(e.target.value) : undefined,
                    )
                  }
                />
                {evidence(key, index)}
              </label>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[["quantityUnit","Miktar birimi"],["color","Gövde rengi"],["fabricType","Kumaş"],["motorType","Motor / tahrik"],["ledType","LED"]].map(([key,label]) => <label key={key} className="text-xs">{label}<input className="rf-input mt-2 w-full" value={item[key] ?? ""} onChange={e => itemField(index,key,e.target.value || undefined)} />{evidence(key === "quantityUnit" ? "unit" : key,index)}</label>)}
          </div>
          {Object.entries(item.customParameters || {}).map(([key,value]) => <label key={key} className="block text-xs">{key}<input className="rf-input mt-2 w-full" type={typeof value === "number" ? "number" : "text"} step="any" value={String(value)} onChange={e => itemField(index,"customParameters",{...item.customParameters,[key]: typeof value === "number" ? Number(e.target.value) : typeof value === "boolean" ? e.target.value === "true" : e.target.value})} />{evidence(`customParameters.${key}`,index)}</label>)}
          <label className="block text-xs">Kalem notu<textarea className="rf-input mt-2 w-full" value={item.notes || ""} onChange={e => itemField(index,"notes",e.target.value)} /></label>
          <ProductDialog
            visualization={item.productVisualization}
            awningConfiguration={item.awningConfiguration}
            previewImage={item.awningPreview}
            onApply={v=>setForm((p:any)=>({...p,items:p.items.map((i:any,n:number)=>n===index?attachVisualization(i,v):i)}))}
            onApplyAwning={(c, image) =>
              setForm((p: any) => ({
                ...p,
                items: p.items.map((i: any, n: number) =>
                  n === index ? applyAwning(i, c, image) : i,
                ),
              }))
            }
            label={`${item.productName || "Ürün"} · 3D yapılandır`}
          />
          <p className="text-xs text-muted-foreground">
            Fiyat satış çalışanının onayladığı değerdir.
          </p>
        </section>
      ))}
      <button type="button" className="rf-secondary-button" onClick={() => setForm((p: any) => ({...p, items:[...p.items,{productName:"",quantity:1,quantityUnit:"adet",unitPrice:0,totalPrice:0,customParameters:{}}]}))}>+ Kalem ekle</button>
      <section className="rf-panel space-y-3">
        <label className="block text-xs">
          Sipariş notu
          <textarea
            className="rf-input mt-2 w-full"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </label>
        <label className="block text-xs">
          Para birimi
          <select
            className="rf-input mt-2"
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          >
            {["TRY", "USD", "EUR", "GBP"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        {requiredReview.length > 0 && <fieldset className="space-y-3"><legend className="mb-3 text-sm font-semibold">Belirsiz alanların kontrolü</legend><p className="text-xs text-muted-foreground">Model güveni doğruluk garantisi değildir. Her alanı belgeyle karşılaştırın veya müşteriden doğrulayın.</p>{requiredReview.map(path => <label key={path} className="flex gap-2 text-xs"><input type="checkbox" required checked={form.reviewedFields.includes(path)} onChange={e => setForm((p: any) => ({...p,reviewedFields:e.target.checked ? [...p.reviewedFields,path] : p.reviewedFields.filter((f: string) => f !== path)}))} />{path.startsWith("items.") ? `Kalem ${Number(path.split(".")[1])+1} · ` : ""}{fieldLabels[path.split(".").slice(-1)[0]] || path.split(".").slice(-1)[0]} kontrol edildi</label>)}</fieldset>}
        <label className="flex gap-2 text-xs">
          <input type="checkbox" required /> Belgeyi ve tüm belirsiz alanları
          kontrol ettim.
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <button
          disabled={busy || !form.items.length}
          className="rf-primary-button"
        >
          {busy ? "Onaylanıyor…" : "Kontrolü onayla ve sipariş oluştur"}
        </button>
      </section>
    </form>
  );
}
export default function IntakeReview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [source, setSource] = useState<{ url: string; name: string; page: number } | null>(null);
  const { id } = use(params),
    { data, error } = useSWR(`/api/v1/production/intake/${id}`, async (url: string) => {const r=await fetch(url,{cache:"no-store"});const body=await r.json();if(!r.ok)throw new Error(body.error);return body;}),
    draft = data?.data;
  return (
    <div className="rf-page space-y-6">
      <Link href="/production" className="text-xs text-primary">
        ← Üretim merkezi
      </Link>
      <h1 className="rf-page-title">Belge ve sipariş incelemesi</h1>
      {!data ? (
        error ? <p role="alert">{error.message}</p> : <div role="status" className="h-40 animate-pulse rounded-md bg-muted motion-reduce:animate-none"><span className="sr-only">Taslak alınıyor</span></div>
      ) : !draft ? (
        <p role="alert">Taslak bulunamadı.</p>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <section className="rf-panel xl:sticky xl:top-24">
            <h2 className="rf-section-title mb-3">Kaynak belge</h2>
            {draft.source_text && (
              <pre className="mb-4 max-h-[70vh] overflow-auto whitespace-pre-wrap text-xs leading-6">
                {draft.source_text}
              </pre>
            )}
            {draft.documents.map((f: any) => (
              <div key={f.id}>
                {f.mime === "application/pdf" ? (
                  <button type="button" className="rf-secondary-button my-3 min-h-12 w-full" onClick={() => setSource({ url: f.url, name: f.name, page: 1 })}>
                    {f.name} · PDF incele
                  </button>
                ) : (
                  <a href={f.url} target="_blank" rel="noreferrer">
                    <img src={f.url} alt={f.name} className="w-full" />
                  </a>
                )}
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs text-primary"
                >
                  {f.name} · Belgede aç
                </a>
              </div>
            ))}
          </section>
          <Review key={draft.id} draft={draft} onSource={page => {
            const pdf = draft.documents.find((file: { mime: string }) => file.mime === "application/pdf");
            if (pdf) setSource({ url: pdf.url, name: pdf.name, page });
          }} />
        </div>
      )}
      {source && <LazyPDFViewer key={`${source.url}:${source.page}`} fileUrl={source.url} fileName={source.name} initialPage={source.page} onClose={() => setSource(null)} />}
    </div>
  );
}
