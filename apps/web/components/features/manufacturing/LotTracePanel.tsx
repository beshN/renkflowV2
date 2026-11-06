"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMemberAccess } from "@/lib/hooks/useMemberAccess";
import { canTraceLots } from "@/lib/features/manufacturing/lot-trace";
import type { Access } from "@/lib/security/access-matrix";
import { requestJson } from "@/lib/shared/network";

type Lot = {
  id: string;
  lot_number: string;
  product_code: string;
  product_name: string;
  warehouse_name: string;
  created_at: string;
  remaining_qty: string | number;
  uom: string;
  parentLotId: string | null;
  workOrders: {
    id: string;
    title: string;
    allocationId: string | null;
    cutPlanId: string | null;
    quantity: string | number;
    uom: string;
    order: { id: string; order_number: string } | null;
  }[];
};
type Query = { type: "heat" | "supplierLot"; number: string };
type Result =
  | { state: "idle" | "loading" | "error" | "hidden" }
  | { state: "ready"; lots: Lot[] };

export function LotTracePanel() {
  const access = useMemberAccess();
  return access && canTraceLots({ ...access, base: access.base as Access["base"] })
    ? <LotSearch key={access.roleKey} />
    : null;
}

function LotSearch() {
  const [type, setType] = useState<Query["type"]>("heat");
  const [number, setNumber] = useState("");
  const [query, setQuery] = useState<Query | null>(null);
  const [result, setResult] = useState<Result>({ state: "idle" });
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function search(next: Query) {
    if (!next.number) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setQuery(next);
    setResult({ state: "loading" });
    const params = new URLSearchParams({ [next.type]: next.number });
    const response = await requestJson<{ data: { lots: Lot[] } }>(
      `/api/v1/traceability/lots?${params}`,
      { cache: "no-store", signal: current.signal },
    );
    if (current.signal.aborted) return;
    if (response.status === 404) setResult({ state: "hidden" });
    else if (response.ok && Array.isArray(response.data?.data?.lots))
      setResult({ state: "ready", lots: response.data.data.lots });
    else setResult({ state: "error" });
  }

  if (result.state === "hidden") return null;
  return (
    <section className="rf-panel space-y-4" aria-label="Lot izleme">
      <h2 className="rf-section-title">Lot izleme</h2>
      <p className="text-sm text-muted-foreground">Numarayı tam olarak girin; tam eşleşme ile aranır.</p>
      <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => {
        event.preventDefault();
        void search({ type, number: number.trim() });
      }}>
        <label className="block text-xs">
          Arama tipi
          <select className="rf-input mt-2 w-full" value={type}
            onChange={(event) => setType(event.target.value as Query["type"])}>
            <option value="heat">Döküm (heat) no</option>
            <option value="supplierLot">Tedarikçi lot no</option>
          </select>
        </label>
        <label className="block text-xs">
          {type === "heat" ? "Döküm (heat) no" : "Tedarikçi lot no"}
          <input className="rf-input mt-2 w-full" value={number} maxLength={64}
            onChange={(event) => setNumber(event.target.value)} />
        </label>
        <button className="rf-primary-button" disabled={!number.trim()}>Ara</button>
      </form>
      {result.state === "loading" && <p role="status">Yükleniyor…</p>}
      {result.state === "error" && (
        <div role="alert">
          <p>Yüklenemedi</p>
          <button className="rf-secondary-button mt-2" onClick={() => { if (query) void search(query); }}>
            Tekrar dene
          </button>
        </div>
      )}
      {result.state === "ready" && (result.lots.length === 0
        ? <p role="status">Bu numarayla kayıtlı lot yok</p>
        : result.lots.map((lot) => (
          <article key={lot.id} className="space-y-2 border-t border-border pt-3 text-sm">
            <h3 className="font-medium">Lot {lot.lot_number}</h3>
            <p>Profil: {lot.product_code} · {lot.product_name}</p>
            <p>Depo: {lot.warehouse_name} · Giriş tarihi: {new Date(lot.created_at).toLocaleDateString("tr-TR")}</p>
            <p>Kalan miktar: {lot.remaining_qty} {lot.uom}</p>
            {lot.parentLotId && <p>Ana lot no: {result.lots.find((parent) => parent.id === lot.parentLotId)?.lot_number ?? "—"}</p>}
            <h4 className="font-medium">Kullanıldığı iş emirleri ve siparişler</h4>
            {lot.workOrders.length === 0 ? <p>Kullanım kaydı yok.</p> : (
              <ul className="space-y-2">
                {lot.workOrders.map((work) => (
                  <li key={`${work.id}:${work.cutPlanId ?? work.allocationId}`}>
                    <span>{work.title} · </span>
                    {work.order && <><Link className="text-primary underline" href={`/orders/${work.order.id}`}>{work.order.order_number}</Link> · </>}
                    <span>{work.cutPlanId ? "Kesim planı" : "Malzeme kaydı"} · {work.quantity} {work.uom}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        )))}
    </section>
  );
}
