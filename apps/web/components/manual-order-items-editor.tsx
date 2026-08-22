"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ClipboardPenLine, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { saveManualOrderItems } from "@/app/actions/core";

export type ManualOrderItemValue = {
  id: string;
  quantity: number;
  widthMm: number | null;
  heightMm: number | null;
  lightColor: string;
  profileType: string;
  motorType: string;
  notes: string;
};

type EditorItem = Omit<ManualOrderItemValue, "quantity" | "widthMm" | "heightMm"> & {
  quantity: string;
  widthMm: string;
  heightMm: string;
};

type EditableField = Exclude<keyof EditorItem, "id">;

export function ManualOrderItemsEditor({
  organizationId,
  orderId,
  orderStatus,
  initialItems,
  approvalBlockedReason,
}: {
  organizationId: string;
  orderId: string;
  orderStatus: "draft" | "awaiting_review" | "approved";
  initialItems: ManualOrderItemValue[];
  approvalBlockedReason?: string;
}) {
  const [items, setItems] = useState<EditorItem[]>(() => initialItems.length
    ? initialItems.map(toEditorItem)
    : [createBlankItem("new-0")]);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function updateItem(id: string, field: EditableField, value: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  function addItem() {
    setItems((current) => current.length >= 250
      ? current
      : [...current, createBlankItem(`new-${Date.now()}-${current.length}`)]);
  }

  function removeItem(id: string) {
    setItems((current) => current.length <= 1 ? current : current.filter((item) => item.id !== id));
  }

  function submit(approve: boolean) {
    startTransition(async () => {
      setMessage("");
      setIsError(false);
      try {
        await saveManualOrderItems({
          organizationId,
          orderId,
          approve,
          items: items.map((item) => ({
            quantity: Number(item.quantity),
            widthMm: item.widthMm === "" ? null : Number(item.widthMm),
            heightMm: item.heightMm === "" ? null : Number(item.heightMm),
            lightColor: item.lightColor,
            profileType: item.profileType,
            motorType: item.motorType,
            notes: item.notes,
          })),
        });
        setMessage(approve ? "Ürün satırları kaydedildi ve sipariş onaylandı." : "Ürün satırları taslağa kaydedildi.");
        router.refresh();
      } catch (cause) {
        setIsError(true);
        setMessage(cause instanceof Error ? cause.message : "Ürün satırları kaydedilemedi.");
      }
    });
  }

  const approveLabel = orderStatus === "approved" ? "Kaydet ve yeniden onayla" : "Kaydet ve üretime onayla";

  return (
    <section className="review-card manual-items-card">
      <div className="review-heading">
        <div><span><ClipboardPenLine size={15} /> Manuel sipariş verisi</span><h2>Ürün satırları</h2></div>
        <p>PDF veya AI kullanmadan sipariş oluşturabilir; ölçü ve üretim alanlarını ofis onayıyla üretime aktarabilirsiniz.</p>
      </div>
      <div className="review-items manual-items-list">
        {items.map((item, index) => (
          <article key={item.id}>
            <div className="item-title">
              <div><b>Ürün satırı {index + 1}</b><span>Ofis tarafından giriliyor</span></div>
              <button type="button" onClick={() => removeItem(item.id)} disabled={items.length <= 1 || pending} aria-label={`${index + 1}. ürün satırını sil`}><Trash2 size={14} /> Satırı sil</button>
            </div>
            <div className="item-fields">
              <ManualInput label="Adet" type="number" min="1" step="1" required value={item.quantity} onChange={(value) => updateItem(item.id, "quantity", value)} />
              <ManualInput label="Genişlik (mm)" type="number" min="0.01" step="0.01" value={item.widthMm} onChange={(value) => updateItem(item.id, "widthMm", value)} />
              <ManualInput label="Yükseklik (mm)" type="number" min="0.01" step="0.01" value={item.heightMm} onChange={(value) => updateItem(item.id, "heightMm", value)} />
              <ManualInput label="Işık rengi" maxLength={120} value={item.lightColor} onChange={(value) => updateItem(item.id, "lightColor", value)} />
              <ManualInput label="Profil tipi" maxLength={120} value={item.profileType} onChange={(value) => updateItem(item.id, "profileType", value)} />
              <ManualInput label="Motor tipi" maxLength={120} value={item.motorType} onChange={(value) => updateItem(item.id, "motorType", value)} />
              <ManualInput label="Satır notu" maxLength={2000} value={item.notes} onChange={(value) => updateItem(item.id, "notes", value)} />
            </div>
          </article>
        ))}
        <button type="button" className="add-review-item" onClick={addItem} disabled={items.length >= 250 || pending}><Plus size={15} /> Ürün satırı ekle</button>
      </div>
      {approvalBlockedReason ? <div className="manual-approval-note">{approvalBlockedReason}</div> : null}
      <div className="review-actions manual-review-actions">
        <span className={isError ? "inline-error" : ""} aria-live="polite">{message}</span>
        <div>
          {orderStatus !== "approved" ? <button type="button" className="button button-secondary" onClick={() => submit(false)} disabled={pending}><Save size={16} />{pending ? "Kaydediliyor…" : "Taslağı kaydet"}</button> : null}
          <button type="button" className="button button-primary" onClick={() => submit(true)} disabled={pending || !!approvalBlockedReason}><CheckCircle2 size={17} />{pending ? "Kaydediliyor…" : approveLabel}</button>
        </div>
      </div>
    </section>
  );
}

export function ReadonlyOrderItems({ items }: { items: ManualOrderItemValue[] }) {
  return (
    <section className="content-card readonly-order-items">
      <div className="card-heading"><div><span>Onaylı sipariş verisi</span><h2>Ürün satırları</h2></div><b>{items.length} satır</b></div>
      {items.length ? <div className="readonly-items-list">{items.map((item, index) => <article key={item.id}>
        <header><b>{index + 1}. ürün</b><strong>{item.quantity} adet</strong></header>
        <dl>
          <div><dt>Ölçü</dt><dd>{formatDimension(item.widthMm)} × {formatDimension(item.heightMm)} mm</dd></div>
          <div><dt>Işık</dt><dd>{item.lightColor || "—"}</dd></div>
          <div><dt>Profil</dt><dd>{item.profileType || "—"}</dd></div>
          <div><dt>Motor</dt><dd>{item.motorType || "—"}</dd></div>
        </dl>
        {item.notes ? <p>{item.notes}</p> : null}
      </article>)}</div> : <div className="compact-empty">Henüz ürün satırı yok.</div>}
    </section>
  );
}

function ManualInput({ label, value, onChange, ...inputProps }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return <label className="review-input"><span>{label}</span><input {...inputProps} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function toEditorItem(item: ManualOrderItemValue): EditorItem {
  return {
    ...item,
    quantity: String(item.quantity),
    widthMm: item.widthMm === null ? "" : String(item.widthMm),
    heightMm: item.heightMm === null ? "" : String(item.heightMm),
  };
}

function createBlankItem(id: string): EditorItem {
  return { id, quantity: "1", widthMm: "", heightMm: "", lightColor: "", profileType: "", motorType: "", notes: "" };
}

function formatDimension(value: number | null) {
  return value === null ? "—" : value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}
