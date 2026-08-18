"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Sparkles, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { reviewAnalysis } from "@/app/actions/core";
import type { ExtractedOrderFields } from "@/lib/types";

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
      const items = structuredClone(current.items);
      const numberField = field === "quantity" || field === "widthMm" || field === "heightMm";
      items[index][field] = { ...items[index][field], value: numberField ? (next === "" ? null : Number(next)) : next } as never;
      return { ...current, items };
    });
  }

  function submit() {
    const corrections = collectCorrections(initial, value);
    startTransition(async () => {
      try {
        await reviewAnalysis({
          organizationId,
          analysisId,
          orderId,
          normalizedOutput: value as unknown as Record<string, unknown>,
          corrections,
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
            <div className="item-title"><b>Ürün satırı {index + 1}</b><span>Kaynak sayfa {item.widthMm.sourcePage ?? item.heightMm.sourcePage ?? "—"}</span></div>
            <div className="item-fields">
              <ReviewInput label="Adet" type="number" field={item.quantity} onChange={(next) => updateItem(index, "quantity", next)} />
              <ReviewInput label="Genişlik (mm)" type="number" field={item.widthMm} onChange={(next) => updateItem(index, "widthMm", next)} />
              <ReviewInput label="Yükseklik (mm)" type="number" field={item.heightMm} onChange={(next) => updateItem(index, "heightMm", next)} />
              <ReviewInput label="Işık rengi" field={item.lightColor} onChange={(next) => updateItem(index, "lightColor", next)} />
              <ReviewInput label="Profil tipi" field={item.profileType} onChange={(next) => updateItem(index, "profileType", next)} />
              <ReviewInput label="Motor tipi" field={item.motorType} onChange={(next) => updateItem(index, "motorType", next)} />
            </div>
          </article>
        ))}
      </div>
      {!!value.warnings.length && <div className="warning-box"><TriangleAlert size={17} /><div><b>Analiz uyarıları</b>{value.warnings.map((warning) => <span key={warning}>{warning}</span>)}</div></div>}
      <div className="review-actions"><span>{message}</span><button className="button button-primary" onClick={submit} disabled={pending}><CheckCircle2 size={17} />{pending ? "Kaydediliyor…" : "Doğrula ve onayla"}</button></div>
    </section>
  );
}

function ReviewInput({
  label,
  field,
  type = "text",
  onChange,
}: {
  label: string;
  field: { value: string | number | null; confidence: number; sourcePage: number | null };
  type?: string;
  onChange: (value: string) => void;
}) {
  const low = field.confidence < 0.72;
  return (
    <label className={`review-input ${low ? "low-confidence" : ""}`}>
      <span>{label}<small>{Math.round(field.confidence * 100)}% · s.{field.sourcePage ?? "—"}</small></span>
      <input type={type} value={field.value ?? ""} min={type === "number" ? 0 : undefined} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function collectCorrections(initial: ExtractedOrderFields, current: ExtractedOrderFields) {
  const corrections: Array<{ fieldPath: string; aiValue: unknown; correctedValue: unknown }> = [];
  const top: TopField[] = ["customerName", "projectName", "orderReference", "notes"];
  for (const key of top) {
    if (!Object.is(initial[key].value, current[key].value)) {
      corrections.push({ fieldPath: key, aiValue: initial[key].value, correctedValue: current[key].value });
    }
  }
  const fields: ItemField[] = ["quantity", "widthMm", "heightMm", "lightColor", "profileType", "motorType", "notes"];
  current.items.forEach((item, index) => fields.forEach((key) => {
    if (!Object.is(initial.items[index]?.[key].value, item[key].value)) {
      corrections.push({ fieldPath: `items.${index}.${key}`, aiValue: initial.items[index]?.[key].value ?? null, correctedValue: item[key].value });
    }
  }));
  return corrections;
}
