"use client";
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { Download, ExternalLink, Mail, Phone, QrCode, Store } from "lucide-react";
import { EmptyState, PageHeader, Skeleton, StatusChip } from "@/components/kit";
import { ProductDialog } from "@/components/features/product-3d/ProductDialog";
import { requestJson } from "@/lib/shared/network";
import { LEAD_STAGE_LABELS, type LeadStage } from "@/lib/features/field/engine";
import type { VisualizationConfiguration } from "@/lib/features/product-3d/catalog";

type Item = { configuration: VisualizationConfiguration; quantity: number; note: string | null; summary: string; hasImage: boolean; image?: string };
type FairRequest = {
  id: string; createdAt: string; event: string | null; contactName: string; companyName: string | null; phone: string; email: string | null;
  city: string | null; note: string | null; marketingConsent: boolean; leadId: string | null; leadNumber: string | null; leadStage: LeadStage | null; items: Item[];
};
const when = (iso: string) => new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

/** Requests from the fair configurator: who asked for what, the 3D configuration, and the lead to price it on. */
export function FairRequestsWorkspace({ enabled, fairUrl }: { enabled: boolean; fairUrl: string }) {
  const [requests, setRequests] = useState<FairRequest[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<FairRequest | null>(null);
  const [showQr, setShowQr] = useState(false);
  const load = useCallback(async () => {
    const r = await requestJson<{ requests: FairRequest[] }>("/api/v1/leads/fair", { cache: "no-store" });
    if (r.ok && r.data) { setRequests(r.data.requests); setError(""); } else setError(r.error || "Fuar talepleri alınamadı");
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function expand(request: FairRequest) {
    if (open?.id === request.id) { setOpen(null); return; }
    setOpen(request);
    const r = await requestJson<{ request: FairRequest }>(`/api/v1/leads/fair/${request.id}`, { cache: "no-store" });
    if (r.ok && r.data) setOpen(r.data.request);
  }

  const today = new Date().toDateString();
  const todayCount = (requests ?? []).filter((r) => new Date(r.createdAt).toDateString() === today).length;
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Satış"
        title="Fuar talepleri"
        hint="Fuar ziyaretçileri QR kodu okutup ürünü 3D olarak tasarlar ve iletişim bilgisini bırakır. Her talep, kaynağı “Fuar” olan bir potansiyel müşteri kaydı açar; fiyatlandırmayı o kayıttan teklife geçerek yapın."
        kpis={[{ label: "toplam", value: requests?.length ?? "—", icon: Store }, { label: "bugün", value: todayCount }]}
        action={<button type="button" className="rf-primary-button inline-flex items-center gap-1 text-sm" onClick={() => setShowQr((v) => !v)}><QrCode size={14} aria-hidden /> QR kodu</button>}
      />
      {!enabled && <p role="status" className="rf-panel text-sm">Fuar sitesi bu kurulumda kapalı. Açmak için ortam değişkenlerine <code>FAIR_TENANT_ID</code> (firma kimliği) ve fuar alan adı için <code>FAIR_HOSTS</code> ekleyin.</p>}
      {showQr && <FairQr url={fairUrl} />}
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {!requests ? (error ? null : <Skeleton className="h-64" />) : !requests.length ? (
        <EmptyState title="Henüz fuar talebi yok" icon={Store} />
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => (
            <li key={r.id} className="rf-panel p-0">
              <button type="button" className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 p-3 text-left" aria-expanded={open?.id === r.id} onClick={() => void expand(r)}>
                <span className="min-w-40 flex-1">
                  <span className="block text-sm font-medium">{r.contactName}{r.companyName ? ` · ${r.companyName}` : ""}</span>
                  <span className="block text-xs text-muted-foreground">{when(r.createdAt)}{r.city ? ` · ${r.city}` : ""}{r.event ? ` · ${r.event}` : ""}</span>
                </span>
                <span className="min-w-48 flex-[2] text-xs">{r.items.map((i) => i.summary).join(" · ")}</span>
                {r.leadNumber && <StatusChip tone={r.leadStage === "won" ? "success" : r.leadStage === "lost" ? "danger" : "info"} label={`${r.leadNumber}${r.leadStage ? ` · ${LEAD_STAGE_LABELS[r.leadStage]}` : ""}`} />}
              </button>
              {open?.id === r.id && <FairRequestDetail request={open} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FairRequestDetail({ request }: { request: FairRequest }) {
  return (
    <div className="space-y-3 border-t border-border p-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <a className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3" href={`tel:${request.phone}`}><Phone size={14} aria-hidden /> {request.phone}</a>
        {request.email && <a className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3" href={`mailto:${request.email}`}><Mail size={14} aria-hidden /> {request.email}</a>}
        {request.leadId && <Link className="inline-flex min-h-11 items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 text-primary" href={`/leads?open=${request.leadId}`}><ExternalLink size={14} aria-hidden /> Potansiyel müşteri kaydı</Link>}
      </div>
      {request.note && <p className="rounded border border-border p-2 text-sm"><span className="text-xs text-muted-foreground">Müşteri notu: </span>{request.note}</p>}
      <p className="text-xs text-muted-foreground">Kampanya izni: {request.marketingConsent ? "verildi" : "yok"}</p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {request.items.map((item, index) => (
          <li key={index} className="space-y-2 rounded-md border border-border p-2">
            {item.image ? (
              <Image src={item.image} alt={item.summary} width={480} height={300} unoptimized className="h-auto w-full rounded" />
            ) : item.hasImage ? <Skeleton className="h-32" /> : null}
            <p className="text-sm font-medium">{item.summary}</p>
            <ConfigurationFacts c={item.configuration} />
            <ProductDialog readOnly visualization={{ configuration: item.configuration }} label="3D incele" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConfigurationFacts({ c }: { c: VisualizationConfiguration }) {
  const swatch = (color: string) => <span className="inline-block h-3 w-3 rounded-full border border-border align-middle" style={{ backgroundColor: color }} aria-hidden />;
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
      <dt className="text-muted-foreground">Gövde</dt><dd>{swatch(c.bodyColor)} {c.bodyColor}</dd>
      {(c.kind === "pergola" || c.kind === "zip") && <><dt className="text-muted-foreground">Kumaş</dt><dd>{swatch(c.fabricColor)} {c.fabricColor}</dd></>}
      <dt className="text-muted-foreground">Yükseklik</dt><dd>{c.heightMm} mm</dd>
      <dt className="text-muted-foreground">Montaj</dt><dd>{c.mounting === "free" ? "Bağımsız" : c.mounting === "planter" ? "Tekerlekli saksı" : "Duvar / zemin"}</dd>
      {c.led !== "off" && <><dt className="text-muted-foreground">LED</dt><dd>{c.led === "warm" ? "Gün ışığı" : "Beyaz"}</dd></>}
    </dl>
  );
}

/** A QR code for the stand: points at the fair site; ?urun= opens one product directly. */
function FairQr({ url }: { url: string }) {
  const [target, setTarget] = useState(url);
  const [image, setImage] = useState("");
  useEffect(() => {
    if (!/^https?:\/\//.test(target)) { setImage(""); return; }
    let cancelled = false;
    void QRCode.toDataURL(target, { width: 640, margin: 2, errorCorrectionLevel: "M" }).then((d) => { if (!cancelled) setImage(d); }).catch(() => setImage(""));
    return () => { cancelled = true; };
  }, [target]);
  return (
    <div className="rf-panel flex flex-wrap items-start gap-4 p-4">
      <div className="min-w-60 flex-1 space-y-2">
        <label className="block text-xs">Fuar sitesi adresi
          <input className="rf-input mt-1 w-full" value={target} onChange={(e) => setTarget(e.target.value.trim())} placeholder="https://fuar.firmaniz.com" />
        </label>
        <p className="text-xs text-muted-foreground">Tek bir ürünü doğrudan açmak için adresin sonuna <code>?urun=pergola</code> gibi ürün kodu, stand veya salon ayırmak için <code>?e=salon-3</code> ekleyebilirsiniz.</p>
        {image && <a className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm" href={image} download="fuar-qr.png"><Download size={14} aria-hidden /> PNG indir</a>}
      </div>
      {image ? <Image src={image} alt={`${target} adresinin QR kodu`} width={200} height={200} unoptimized className="rounded bg-white p-1" /> : <p className="text-xs text-muted-foreground">Geçerli bir adres yazın.</p>}
    </div>
  );
}
