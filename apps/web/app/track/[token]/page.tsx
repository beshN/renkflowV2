"use client";
import { use, useEffect, useState } from "react";
import { AwningDialog } from "@/components/features/awning/AwningConfigurator";
import { awningSummary } from "@/lib/features/awning/configuration";
const statuses: Record<string, string> = {
  pending: "Sipariş alındı",
  new: "Sipariş alındı",
  preparing_materials: "Malzemeler hazırlanıyor",
  in_production: "Üretimde",
  quality_check: "Kalite kontrol",
  ready_for_shipment: "Paketlendi",
  shipped: "Sevk edildi",
  delivered: "Teslim edildi",
  completed: "Teslim edildi",
  cancelled: "İptal edildi",
  on_hold: "Beklemede",
};
export default function Tracking({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params),
    [data, setData] = useState<any>(),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setData(undefined);
    setError("");
    async function load() {
      try {
        const r = await fetch(`/api/v1/tracking/${token}`, {
          signal: c.signal,
          cache: "no-store",
        });
        const body = await r.json();
        if (!r.ok) {
          setError(body.error);
          return;
        }
        if (c.signal.aborted) return;
        setError("");
        setData(body.data);
      } catch {
        if (!c.signal.aborted) setError("Takip bilgisi alınamadı");
      }
    }
    void load();
    const timer = setInterval(load, 20000);
    return () => {
      c.abort();
      clearInterval(timer);
    };
  }, [token]);
  return (
    <main className="mx-auto min-h-screen max-w-4xl space-y-8 p-6 pt-12">
      <p className="rf-eyebrow">RENK ALÜMİNYUM · SİPARİŞ TAKİBİ</p>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p role="status">Sipariş yükleniyor…</p>
      ) : (
        <>
          <div>
            <h1 className="text-3xl font-semibold">{data.orderNumber}</h1>
            <p className="mt-3 text-xl text-primary">
              {statuses[data.status] || "Siparişiniz işleme alındı"}
            </p>
          </div>
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {["Sipariş alındı", "Üretimde", "Paketlendi", "Sevk edildi"].map(
              (label, i) => (
                <li
                  key={label}
                  className={`rf-panel text-sm ${i <= (["shipped", "delivered", "completed"].includes(data.status) ? 3 : ["ready", "ready_for_shipment"].includes(data.status) ? 2 : ["in_production", "quality_check"].includes(data.status) ? 1 : 0) ? "border-primary/40 bg-primary/5" : ""}`}
                >
                  <span className="mb-2 block text-xs text-muted-foreground">
                    0{i + 1}
                  </span>
                  {label}
                </li>
              ),
            )}
          </ol>
          {data.items.map((item: any) => (
            <section key={item.id} className="rf-panel space-y-3">
              <h2 className="font-medium">
                {item.product_name} · {item.quantity} adet
              </h2>
              {item.awning_configuration && (
                <>
                  <p className="text-xs leading-6">
                    {awningSummary(item.awning_configuration)}
                  </p>
                  <AwningDialog
                    configuration={item.awning_configuration}
                    previewImage={item.awning_preview}
                    readOnly
                    label="Onaylı 3D görünümü aç"
                  />
                </>
              )}
            </section>
          ))}
          <section className="rf-panel">
            <h2 className="mb-4 font-medium">Sevkiyat</h2>
            {data.shipments.length ? (
              data.shipments.map((s: any, i: number) => (
                <p key={i} className="py-2 text-sm">
                  {s.quantity} adet · {s.carrier || "Sevkiyat"}{" "}
                  {s.tracking_number} ·{" "}
                  {s.status === "delivered" ? "Teslim edildi" : "Yolda"} ·{" "}
                  {new Date(s.created_at).toLocaleDateString("tr-TR")}
                </p>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Sevkiyat henüz başlamadı.
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
