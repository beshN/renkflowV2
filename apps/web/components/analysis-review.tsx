"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Plus, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { reviewAnalysis } from "@/app/actions/core";
import type { ExtractedOrderFields, ExtractedOrderLine } from "@/lib/types";

type TopField = "customerName" | "projectName" | "orderReference" | "notes";
type ItemField = "quantity" | "widthMm" | "heightMm" | "lightColor" | "profileType" | "motorType" | "notes";

export function AnalysisReview({
  analysisId,
  orderId,
  organizationId,
  initial,
}: {
  analysisId: string;
  orderId: string;
  organizationId: string;
  initial: ExtractedOrderFields;
}) {
  const [value, setValue] = useState(initial);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function updateTop(field: TopField, next: string) {
    setValue((current) => ({ ...current, [field]: { ...current[field], value: next } }));
  }

  function updateItem(index: number, field: ItemField, next: string) {
    setValue((current) => {
      const numberField = field === "quantity" || field === "widthMm" || field === "heightMm";
      const items = current.items.map((item, itemIndex) => itemIndex === index
        ? { ...item, [field]: { ...item[field], value: numberField ? (next === "" ? null : Number(next)) : next } }
        : item) as ExtractedOrderLine[];
      return { ...current, items };
    });
  }

  function addItem() {
    setValue((current) => current.items.length >= 250
      ? current
      : { ...current, items: [...current.items, createBlankOrderLine()] });
  }

  function removeItem(index: number) {
    setValue((current) => current.items.length <= 1
      ? current
      : { ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) });
  }

  function submit() {
    startTransition(async () => {
      try {
        await reviewAnalysis({
          organizationId,
          analysisId,
          orderId,
          normalizedOutput: value as unknown as Record<string, unknown>,
        });
        setMessage("Analiz doğrulandı ve sipariş onaylandı.");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Onay tamamlanamadı.");
      }
    });
  }

  return (
    <section className="review-card">
      <div className="review-heading"><div><span><Sparkles size={15} /> AI alanları</span><h2>Ofis kontrolü</h2></div><p>Her alanı PDF ile karşılaştırın. Değişiklikler bilgi tabanına kaydedilir.</p></div>
      <div className="review-top-grid">
        <ReviewInput label="Müşteri" field={value.customerName} onChange={(next) => updateTop("customerName", next)} />
        <ReviewInput label="Proje" field={value.projectName} onChange={(next) => updateTop("projectName", next)} />
        <ReviewInput label="Sipariş referansı" field={value.orderReference} onChange={(next) => updateTop("orderReference", next)} />
        <ReviewInput label="Genel not" field={value.notes} onChange={(next) => updateTop("notes", next)} />
      </div>
      <div className="review-items">
        {value.items.map((item, index) => (
          <article key={index}>
            <div className="item-title"><div><b>Ürün satırı {index + 1}</b><span>Kaynak sayfa {item.widthMm.sourcePage ?? item.heightMm.sourcePage ?? "—"}</span></div><button type="button" onClick={() => removeItem(index)} disabled={value.items.length <= 1} aria-label={`${index + 1}. ürün satırını sil`}><Trash2 size={14} /> Satırı sil</button></div>
            <div className="item-fields">
              <ReviewInput label="Adet" type="number" step="1" field={item.quantity} onChange={(next) => updateItem(index, "quantity", next)} />
              <ReviewInput label="Genişlik (mm)" type="number" step="0.01" field={item.widthMm} onChange={(next) => updateItem(index, "widthMm", next)} />
              <ReviewInput label="Yükseklik (mm)" type="number" step="0.01" field={item.heightMm} onChange={(next) => updateItem(index, "heightMm", next)} />
              <ReviewInput label="Işık rengi" field={item.lightColor} onChange={(next) => updateItem(index, "lightColor", next)} />
              <ReviewInput label="Profil tipi" field={item.profileType} onChange={(next) => updateItem(index, "profileType", next)} />
              <ReviewInput label="Motor tipi" field={item.motorType} onChange={(next) => updateItem(index, "motorType", next)} />
              <ReviewInput label="Satır notu" field={item.notes} onChange={(next) => updateItem(index, "notes", next)} />
            </div>
          </article>
        ))}
        <button type="button" className="add-review-item" onClick={addItem} disabled={value.items.length >= 250}><Plus size={15} /> Ürün satırı ekle</button>
      </div>
      {!!value.warnings.length && <div className="warning-box"><TriangleAlert size={17} /><div><b>Analiz uyarıları</b>{value.warnings.map((warning) => <span key={warning}>{warning}</span>)}</div></div>}
      <div className="review-actions"><span aria-live="polite">{message}</span><button type="button" className="button button-primary" onClick={submit} disabled={pending}><CheckCircle2 size={17} />{pending ? "Kaydediliyor…" : "Doğrula ve onayla"}</button></div>
    </section>
  );
}

function ReviewInput({
  label,
  field,
  type = "text",
  step,
  onChange,
}: {
  label: string;
  field: { value: string | number | null; confidence: number; sourcePage: number | null };
  type?: string;
  step?: string;
  onChange: (value: string) => void;
}) {
  const low = field.confidence < 0.72;
  return (
    <label className={`review-input ${low ? "low-confidence" : ""}`}>
      <span>{label}<small>{field.sourcePage ? `${Math.round(field.confidence * 100)}% · s.${field.sourcePage}` : "PDF'de kaynak yok"}</small></span>
      <input type={type} step={step} value={field.value ?? ""} min={type === "number" ? 0 : undefined} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function createBlankOrderLine(): ExtractedOrderLine {
  const field = <T,>(value: T | null) => ({ value, confidence: 0, sourcePage: null, sourceText: null });
  return {
    quantity: field(1),
    widthMm: field<number>(null),
    heightMm: field<number>(null),
    lightColor: field<string>(null),
    profileType: field<string>(null),
    motorType: field<string>(null),
    notes: field<string>(null),
  };
}
