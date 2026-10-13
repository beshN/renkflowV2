"use client";
import { use, useEffect, useState } from "react";
import { BadgeCheck, CalendarCheck2, Factory, FileText, MessageCircle, PackageCheck, Scissors, Truck, Wrench } from "lucide-react";
import { ProductDialog } from "@/components/features/product-3d/ProductDialog";
import { ProductDrawing } from "@/components/drawing/ProductDrawing";
import { ColorChip } from "@/components/colors/ColorSwatch";
import { ProgressRing, Skeleton, Timeline } from "@/components/kit";
import { LIFECYCLE, lifecycleIndex } from "@/lib/features/orders/lifecycle";
import { normalizeOrderStatus } from "@/lib/features/orders/workspace";
import { cn } from "@/lib/utils";

/** One short sentence per status, written for the customer. */
const SENTENCE: Record<string, string> = {
  new: "Siparişiniz alındı.",
  pending_approval: "Siparişiniz onay bekliyor.",
  approved: "Siparişiniz onaylandı.",
  preparing_materials: "Malzemeleriniz hazırlanıyor.",
  ready_for_production: "Üretim sırasına alındı.",
  in_production: "Profilleriniz kesiliyor ve işleniyor.",
  quality_check: "Montaj ve kalite kontrolde.",
  ready_for_shipment: "Paketlendi, sevke hazır.",
  shipped: "Yola çıktı.",
  completed: "Teslim edildi.",
  cancelled: "Sipariş iptal edildi.",
  on_hold: "Sipariş beklemede.",
};
const ICONS = [FileText, BadgeCheck, Factory, Scissors, Wrench, Truck];

export default function Tracking({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<any>();
  const [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setData(undefined);
    setError("");
    async function load() {
      try {
        const r = await fetch(`/api/v1/tracking/${token}`, { signal: c.signal, cache: "no-store" });
        const body = await r.json();
        if (!r.ok) { setError(body.error); return; }
        if (c.signal.aborted) return;
        setError("");
        setData(body.data);
      } catch {
        if (!c.signal.aborted) setError("Takip bilgisi alınamadı");
      }
    }
    void load();
    const timer = setInterval(load, 20000);
    return () => { c.abort(); clearInterval(timer); };
  }, [token]);

  const status = data ? normalizeOrderStatus(data.status) : "";
  const at = data ? (status === "completed" ? LIFECYCLE.length : lifecycleIndex(status)) : -1;
  const share = () => {
    const text = `Siparişim ${data.orderNumber}: ${SENTENCE[status] ?? ""} ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-6 p-4 pt-10 sm:p-6 sm:pt-12">
      <p className="rf-eyebrow">RENK ALÜMİNYUM · SİPARİŞ TAKİBİ</p>
      {error ? <p role="alert" className="rf-alert">{error}</p> : !data ? (
        <div className="space-y-4" role="status"><span className="sr-only">Sipariş bilgisi alınıyor</span><Skeleton className="h-10 w-48" /><Skeleton className="h-20 w-full" /><Skeleton className="h-48 w-full" /></div>
      ) : (
        <>
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-mono text-3xl font-semibold">{data.orderNumber}</h1>
              <p className="mt-2 text-xl text-primary">{SENTENCE[status] ?? "Siparişiniz işleme alındı."}</p>
            </div>
            <button type="button" onClick={share} className="rf-secondary-button h-10 gap-2 px-3 text-sm"><MessageCircle size={16} aria-hidden /> WhatsApp&apos;ta paylaş</button>
          </header>

          {at >= 0 && (
            <ol className="flex items-start" aria-label="Sipariş aşamaları">
              {LIFECYCLE.map((step, i) => {
                const Icon = ICONS[i];
                const done = i < at, current = i === at;
                return (
                  <li key={step.key} className="flex flex-1 flex-col items-center gap-1.5 text-center" aria-current={current ? "step" : undefined}>
                    <span className="relative flex w-full items-center">
                      <span aria-hidden className={cn("h-1 flex-1", i === 0 ? "bg-transparent" : done || current ? "bg-primary" : "bg-border")} />
                      <span className={cn("relative grid h-10 w-10 shrink-0 place-items-center rounded-full border-2",
                        done ? "border-primary bg-primary text-primary-foreground" : current ? "border-primary bg-background text-primary" : "border-border bg-background text-muted-foreground")}>
                        {current && <span aria-hidden className="absolute inset-0 animate-ping rounded-full border-2 border-primary/40 motion-reduce:hidden" />}
                        <Icon size={18} aria-hidden />
                      </span>
                      <span aria-hidden className={cn("h-1 flex-1", i === LIFECYCLE.length - 1 ? "bg-transparent" : done ? "bg-primary" : "bg-border")} />
                    </span>
                    <span className={cn("text-[11px] sm:text-xs", current ? "font-semibold" : "text-muted-foreground")}>{step.label}</span>
                  </li>
                );
              })}
            </ol>
          )}

          {data.deliveryDate && (
            <p className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
              <CalendarCheck2 size={18} aria-hidden className="text-primary" />
              <span className="text-muted-foreground">Tahmini teslim</span>
              <strong className="ml-auto tabular-nums">{new Date(data.deliveryDate + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" })}</strong>
            </p>
          )}

          {data.items.map((item: any) => {
            const jobs = data.jobs.filter((j: any) => j.order_item_id === item.id);
            const planned = jobs.reduce((n: number, j: any) => n + Number(j.planned_qty || 0), 0);
            const produced = jobs.reduce((n: number, j: any) => n + Number(j.produced_qty || 0), 0);
            return (
              <section key={item.id} className="rf-panel space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-medium">{item.product_name}</h2>
                    <p className="text-sm text-muted-foreground">{item.quantity} adet{item.color ? <> · <ColorChip color={item.color} size={14} /></> : null}</p>
                  </div>
                  {planned > 0 && <ProgressRing value={produced} max={planned} label={`${produced} / ${planned} üretildi`} center={`${produced}/${planned}`} />}
                </div>
                {item.parameters && <ProductDrawing family={item.family ?? "pergola"} widthMm={item.parameters.widthMm} projectionMm={item.parameters.projectionMm} heightMm={item.parameters.mountingHeightMm} color={item.color} className="h-auto max-h-64 w-full" />}
                {(item.awning_configuration || item.product_visualization) && <ProductDialog visualization={item.product_visualization} awningConfiguration={item.awning_configuration} previewImage={item.awning_preview} readOnly label="Kaydedilmiş 3D görünümü aç" />}
              </section>
            );
          })}

          {data.shipments.length > 0 && (
            <section className="rf-panel">
              <h2 className="mb-4 flex items-center gap-2 font-medium"><Truck size={16} aria-hidden /> Sevkiyat</h2>
              <Timeline items={data.shipments.map((s: any, i: number) => ({
                id: String(i),
                icon: s.status === "delivered" ? PackageCheck : Truck,
                tone: s.status === "delivered" ? "in" : "neutral",
                title: `${s.quantity} adet · ${s.status === "delivered" ? "Teslim edildi" : "Yolda"}`,
                when: new Date(s.created_at).toLocaleDateString("tr-TR"),
                detail: [s.carrier, s.tracking_number].filter(Boolean).join(" "),
              }))} />
            </section>
          )}
        </>
      )}
    </main>
  );
}
