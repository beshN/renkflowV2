"use client";
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { Download, ExternalLink, Mail, Pencil, Phone, Plus, QrCode, Store } from "lucide-react";
import { EmptyState, PageHeader, Skeleton, StatusChip, type Tone } from "@/components/kit";
import { ProductDialog } from "@/components/features/product-3d/ProductDialog";
import { requestJson } from "@/lib/shared/network";
import type { DesignItem } from "@/lib/features/fair/design";
import { fairText, LOCALES, LOCALE_NAMES } from "@/lib/features/fair/i18n";

const QUOTE_STATUSES = ["new", "reviewing", "quoted", "sent", "accepted", "rejected"] as const;
type QuoteStatus = (typeof QUOTE_STATUSES)[number];
const STATUS_LABEL = fairText("tr").status as Record<QuoteStatus, string>;
const STATUS_TONE: Record<QuoteStatus, Tone> = { new: "info", reviewing: "warning", quoted: "neutral", sent: "neutral", accepted: "success", rejected: "danger" };
const EMAIL_LABEL: Record<string, string> = { sent: "Onay e-postası gönderildi", failed: "Onay e-postası gönderilemedi", not_configured: "E-posta servisi yapılandırılmamış (RESEND_API_KEY)", pending: "E-posta bekliyor" };

type Item = DesignItem & { summary: string; specs: Array<[string, string]>; hasImage: boolean };
type Quote = {
  id: string; number: string; status: QuoteStatus; createdAt: string; contactName: string; email: string; phone: string | null; companyName: string | null;
  location: string | null; note: string | null; locale: string; marketingConsent: boolean; emailStatus: string; emailError: string | null;
  fair: { code: string; name: string } | null; leadId: string | null; leadNumber: string | null; designUrl: string | null; items: Item[];
};
type Fair = { id: string; code: string; name: string; startsOn: string | null; endsOn: string | null; defaultLocale: "tr" | "en" | "de"; active: boolean; campaign: string | null; source: string | null; designs: number; quotes: number };

const when = (iso: string) => new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
const send = (url: string, method: string, body: unknown) => requestJson<any>(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** Sales side of the product configurator: quote requests with their status, and the fairs. */
export function ConfiguratorAdmin({ enabled, publicBase }: { enabled: boolean; publicBase: string }) {
  const [tab, setTab] = useState<"quotes" | "fairs">("quotes");
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [fairs, setFairs] = useState<Fair[] | null>(null);
  const [filter, setFilter] = useState({ status: "", fair: "" });
  const [error, setError] = useState("");
  const loadQuotes = useCallback(async () => {
    const q = new URLSearchParams(Object.entries(filter).filter(([, v]) => v));
    const r = await requestJson<{ quotes: Quote[] }>(`/api/v1/leads/fair?${q}`, { cache: "no-store" });
    if (r.ok && r.data) { setQuotes(r.data.quotes); setError(""); } else setError(r.error || "Teklif talepleri alınamadı");
  }, [filter]);
  const loadFairs = useCallback(async () => {
    const r = await requestJson<{ fairs: Fair[] }>("/api/v1/leads/fair/fairs", { cache: "no-store" });
    if (r.ok && r.data) setFairs(r.data.fairs); else setError(r.error || "Fuarlar alınamadı");
  }, []);
  useEffect(() => { if (enabled) void loadQuotes(); }, [enabled, loadQuotes]);
  useEffect(() => { if (enabled) void loadFairs(); }, [enabled, loadFairs]);

  const open = (quotes ?? []).filter((q) => q.status === "new" || q.status === "reviewing").length;
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Satış"
        title="Konfigüratör teklif talepleri"
        hint="Fuar kioskunda veya web konfigüratöründe tasarlanıp telefondan gönderilen teklif talepleri. Her talep kaynağı Fuar/Web olan bir potansiyel müşteri kaydı da açar; fiyatı oradan teklife geçerek hazırlayın ve durumu burada güncelleyin."
        kpis={[{ label: "talep", value: quotes?.length ?? "—", icon: Store }, { label: "açık", value: open, tone: open ? "warning" : "neutral" }, { label: "fuar", value: fairs?.length ?? "—" }]}
      />
      {!enabled && <p role="status" className="rf-panel text-sm">Ürün konfigüratörü bu kurulumda kapalı. Açmak için ortam değişkenlerine <code>FAIR_TENANT_ID</code> (firma kimliği), alan adı için <code>FAIR_HOSTS</code> ve <code>FAIR_PUBLIC_URL</code> ekleyin.</p>}
      {enabled && (
        <div role="tablist" className="flex gap-2">
          {(["quotes", "fairs"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={`min-h-10 rounded-md border px-4 text-sm ${tab === t ? "border-foreground bg-foreground text-background" : "border-border"}`} onClick={() => setTab(t)}>
              {t === "quotes" ? "Teklif talepleri" : "Fuarlar"}
            </button>
          ))}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {enabled && tab === "quotes" && (
        <>
          <div className="flex flex-wrap gap-2">
            <label className="text-xs">Durum
              <select className="rf-input mt-1 block" value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}>
                <option value="">Tümü</option>
                {QUOTE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </label>
            <label className="text-xs">Kaynak
              <select className="rf-input mt-1 block" value={filter.fair} onChange={(e) => setFilter((f) => ({ ...f, fair: e.target.value }))}>
                <option value="">Tümü</option>
                <option value="web">Web (fuar dışı)</option>
                {(fairs ?? []).map((f) => <option key={f.id} value={f.code}>{f.name}</option>)}
              </select>
            </label>
          </div>
          {!quotes ? <Skeleton className="h-64" /> : !quotes.length ? <EmptyState title="Henüz teklif talebi yok" icon={Store} /> : (
            <ul className="space-y-2">{quotes.map((q) => <QuoteRow key={q.id} quote={q} onChanged={loadQuotes} />)}</ul>
          )}
        </>
      )}
      {enabled && tab === "fairs" && <FairsPanel fairs={fairs} publicBase={publicBase} onChanged={loadFairs} />}
    </div>
  );
}

function QuoteRow({ quote, onChanged }: { quote: Quote; onChanged: () => void }) {
  const [detail, setDetail] = useState<Quote | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState(quote.status);
  const [error, setError] = useState("");
  async function toggle() {
    setExpanded((v) => !v);
    if (!detail) {
      const r = await requestJson<{ quote: Quote }>(`/api/v1/leads/fair/${quote.id}`, { cache: "no-store" });
      if (r.ok && r.data) setDetail(r.data.quote);
    }
  }
  async function changeStatus(next: QuoteStatus) {
    setStatus(next);
    const r = await send(`/api/v1/leads/fair/${quote.id}`, "PATCH", { status: next });
    if (!r.ok) { setError(r.error || "Durum kaydedilemedi"); setStatus(quote.status); } else { setError(""); onChanged(); }
  }
  const q = detail ?? quote;
  return (
    <li className="rf-panel p-0">
      <button type="button" className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 p-3 text-left" aria-expanded={expanded} onClick={() => void toggle()}>
        <span className="w-36 font-mono text-xs">{quote.number}</span>
        <span className="min-w-40 flex-1">
          <span className="block text-sm font-medium">{quote.contactName}{quote.companyName ? ` · ${quote.companyName}` : ""}</span>
          <span className="block text-xs text-muted-foreground">{when(quote.createdAt)} · {quote.fair?.name ?? "Web"}</span>
        </span>
        <span className="min-w-48 flex-[2] text-xs">{quote.items.map((i) => i.summary).join(" · ")}</span>
        <StatusChip tone={STATUS_TONE[status]} label={STATUS_LABEL[status]} />
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-border p-3">
          <div className="flex flex-wrap items-end gap-2 text-sm">
            <label className="text-xs">Durum
              <select className="rf-input mt-1 block" value={status} onChange={(e) => void changeStatus(e.target.value as QuoteStatus)}>
                {QUOTE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </label>
            <a className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3" href={`mailto:${q.email}`}><Mail size={14} aria-hidden /> {q.email}</a>
            {q.phone && <a className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3" href={`tel:${q.phone}`}><Phone size={14} aria-hidden /> {q.phone}</a>}
            {q.leadId && <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 text-primary" href={`/leads?open=${q.leadId}`}><ExternalLink size={14} aria-hidden /> {q.leadNumber ?? "Potansiyel müşteri"}</Link>}
            {q.designUrl && <a className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3" href={q.designUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} aria-hidden /> Tasarım bağlantısı</a>}
          </div>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
            {q.location && <><dt className="text-muted-foreground">Ülke / şehir</dt><dd>{q.location}</dd></>}
            <dt className="text-muted-foreground">Dil</dt><dd>{q.locale.toUpperCase()}</dd>
            <dt className="text-muted-foreground">Pazarlama izni</dt><dd>{q.marketingConsent ? "Verildi" : "Yok"}</dd>
            <dt className="text-muted-foreground">E-posta</dt><dd>{EMAIL_LABEL[q.emailStatus] ?? q.emailStatus}{q.emailError ? ` — ${q.emailError}` : ""}</dd>
          </dl>
          {q.note && <p className="rounded border border-border p-2 text-sm"><span className="text-xs text-muted-foreground">Müşteri notu: </span>{q.note}</p>}
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {q.items.map((item) => (
              <li key={item.id} className="space-y-2 rounded-md border border-border p-2">
                {item.image ? <Image src={item.image} alt={item.summary} width={480} height={300} unoptimized className="h-auto w-full rounded" /> : item.hasImage ? <Skeleton className="h-32" /> : null}
                <p className="text-sm font-medium">{item.summary}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                  {item.specs.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}
                </dl>
                <ProductDialog readOnly label="3D incele" {...(item.kind === "makasli" ? { awningConfiguration: item.awning } : { visualization: item.configuration ? { configuration: item.configuration } : null })} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

const EMPTY_FAIR = { code: "", name: "", startsOn: "", endsOn: "", defaultLocale: "en" as Fair["defaultLocale"], active: true, campaign: "", source: "" };

function FairsPanel({ fairs, publicBase, onChanged }: { fairs: Fair[] | null; publicBase: string; onChanged: () => void }) {
  const [form, setForm] = useState<(typeof EMPTY_FAIR & { id?: string }) | null>(null);
  const [qrFor, setQrFor] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const { id, ...body } = form;
    const r = await send(id ? `/api/v1/leads/fair/fairs/${id}` : "/api/v1/leads/fair/fairs", id ? "PATCH" : "POST", { ...body, startsOn: body.startsOn || null, endsOn: body.endsOn || null });
    if (!r.ok) { setError(r.error || "Fuar kaydedilemedi"); return; }
    setError("");
    setForm(null);
    onChanged();
  }
  const link = (code: string) => `${publicBase}/fair/${code}`;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Genel (fuar dışı) konfigüratör: <a className="underline" href={publicBase} target="_blank" rel="noreferrer">{publicBase}</a></p>
        <button type="button" className="rf-primary-button inline-flex items-center gap-1 text-sm" onClick={() => setForm({ ...EMPTY_FAIR })}><Plus size={14} aria-hidden /> Yeni fuar</button>
      </div>
      {form && (
        <form onSubmit={save} className="rf-panel grid gap-3 p-4 sm:grid-cols-2" aria-label="Fuar">
          <label className="text-xs">Fuar adı<input className="rf-input mt-1 w-full" required maxLength={160} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="text-xs">Fuar kodu (adres: /fair/kod)<input className="rf-input mt-1 w-full" required pattern="[a-z0-9][a-z0-9-]{1,39}" placeholder="rt2027" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })} /></label>
          <label className="text-xs">Başlangıç<input className="rf-input mt-1 w-full" type="date" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} /></label>
          <label className="text-xs">Bitiş<input className="rf-input mt-1 w-full" type="date" value={form.endsOn} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} /></label>
          <label className="text-xs">Varsayılan dil
            <select className="rf-input mt-1 w-full" value={form.defaultLocale} onChange={(e) => setForm({ ...form, defaultLocale: e.target.value as Fair["defaultLocale"] })}>
              {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" className="h-5 w-5" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Aktif (kiosk adresi açık)</label>
          <label className="text-xs sm:col-span-2">Kampanya açıklaması (kiosk karşılama ekranında görünür)<textarea className="rf-input mt-1 w-full" maxLength={1000} value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} /></label>
          <label className="text-xs sm:col-span-2">Kaynak bilgisi (raporlama için, ör. salon/stand)<input className="rf-input mt-1 w-full" maxLength={200} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></label>
          {error && <p role="alert" className="text-sm text-rose-700 sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="rf-primary-button">Kaydet</button>
            <button type="button" className="rounded-md border border-border px-3 text-sm" onClick={() => setForm(null)}>Vazgeç</button>
          </div>
        </form>
      )}
      {!fairs ? <Skeleton className="h-40" /> : !fairs.length ? <EmptyState title="Henüz fuar yok" icon={Store} /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-2">Fuar</th><th className="p-2">Kod</th><th className="p-2">Tarih</th><th className="p-2">Dil</th><th className="p-2">Durum</th><th className="p-2 text-right">Tasarım</th><th className="p-2 text-right">Teklif</th><th className="p-2" /></tr></thead>
            <tbody>
              {fairs.map((fair) => (
                <tr key={fair.id} className="border-t border-border align-top">
                  <td className="p-2">{fair.name}{fair.source ? <span className="block text-xs text-muted-foreground">{fair.source}</span> : null}</td>
                  <td className="p-2 font-mono text-xs">{fair.code}</td>
                  <td className="p-2 text-xs">{fair.startsOn ?? "—"} – {fair.endsOn ?? "—"}</td>
                  <td className="p-2 text-xs uppercase">{fair.defaultLocale}</td>
                  <td className="p-2"><StatusChip tone={fair.active ? "success" : "muted"} label={fair.active ? "Aktif" : "Pasif"} /></td>
                  <td className="p-2 text-right tabular-nums">{fair.designs}</td>
                  <td className="p-2 text-right tabular-nums">{fair.quotes}</td>
                  <td className="p-2">
                    <div className="flex justify-end gap-1">
                      <a className="rf-icon-button" href={link(fair.code)} target="_blank" rel="noreferrer" aria-label={`${fair.name} kiosk adresi`}><ExternalLink size={15} /></a>
                      <button type="button" className="rf-icon-button" aria-label={`${fair.name} QR kodu`} onClick={() => setQrFor(qrFor === fair.code ? null : fair.code)}><QrCode size={15} /></button>
                      <button type="button" className="rf-icon-button" aria-label={`${fair.name} düzenle`} onClick={() => setForm({ id: fair.id, code: fair.code, name: fair.name, startsOn: fair.startsOn ?? "", endsOn: fair.endsOn ?? "", defaultLocale: fair.defaultLocale, active: fair.active, campaign: fair.campaign ?? "", source: fair.source ?? "" })}><Pencil size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {qrFor && <LinkQr url={link(qrFor)} />}
    </div>
  );
}

/** A QR for a fixed link (e.g. a poster pointing at the fair's kiosk address). */
function LinkQr({ url }: { url: string }) {
  const [image, setImage] = useState("");
  useEffect(() => {
    void QRCode.toDataURL(url, { width: 640, margin: 2 }).then(setImage).catch(() => setImage(""));
  }, [url]);
  return (
    <div className="rf-panel flex flex-wrap items-center gap-4 p-4">
      {image && <Image src={image} alt={`${url} QR kodu`} width={180} height={180} unoptimized className="rounded bg-white p-1" />}
      <div className="space-y-2 text-sm">
        <p className="break-all font-mono text-xs">{url}</p>
        {image && <a className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3" href={image} download="konfigurator-qr.png"><Download size={14} aria-hidden /> PNG indir</a>}
      </div>
    </div>
  );
}
