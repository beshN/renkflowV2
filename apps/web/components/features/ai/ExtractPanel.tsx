'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, FileText, TriangleAlert, Upload, X } from 'lucide-react';
import { requestJson } from '@/lib/shared/network';

type Conf = 'high' | 'medium' | 'low';
type F<T> = { value: T; confidence: Conf; source: 'rules' | 'model'; evidence?: string } | null;
type Req = { customer: F<string>; phone: F<string>; email: F<string>; address: F<string>; lines: Array<{ family: F<string>; widthMm: F<number>; projectionMm: F<number>; color: F<string>; quantity: NonNullable<F<number>> }>; notes: string[] };
type QuoteResult = { type: 'preview'; suggestionId: string; version: number; request: Req; usedModel: boolean } | { type: 'need'; message: string };
type OfferResult =
  | { type: 'preview'; suggestionId: string; version: number; currency: string; offer: { prices: Array<{ lineId: string; unitPrice: number | null; confidence: Conf; evidence: string | null }>; leadTimeDays: number | null; validUntil: string | null; unmatched: string[] }; lines: Array<{ lineId: string; name: string; quantity: number }> }
  | { type: 'need'; message: string };
type Rfq = { id: string; number: string; status: string; suppliers: Array<{ id: string; name: string }> };

const FAMILY: Record<string, string> = { pergola: 'Pergola', awning: 'Tente', guillotine: 'Giyotin cam', zip: 'Zip perde', rolling_roof: 'Rolling roof', winter_garden: 'Kış bahçesi' };
const CONF: Record<Conf, string> = { high: 'Emin', medium: 'Kontrol edin', low: 'Emin değil' };

/** One extracted value; anything below "high" (or missing) is yellow so the person checks it. */
export function FieldValue({ label, field, show }: { label: string; field: F<string | number>; show?: (v: any) => string }) {
  const weak = !field || field.confidence !== 'high';
  return (
    <div className={`flex flex-wrap items-baseline gap-2 rounded px-1 ${weak ? 'bg-amber-100 dark:bg-amber-900/40' : ''}`} data-confidence={field?.confidence ?? 'missing'}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{field ? (show ? show(field.value) : String(field.value)) : '—'}</dd>
      <span className="text-[11px] text-muted-foreground">{field ? `${CONF[field.confidence]}${field.source === 'model' ? ' · model' : ''}` : 'Bulunamadı'}</span>
    </div>
  );
}

async function decide(id: string, version: number, action: 'approve' | 'reject') {
  return requestJson<{ result?: { href?: string } }>(`/api/v1/ai/suggestions/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, expectedVersion: version }) });
}

function Decision({ id, version, approveLabel }: { id: string; version: number; approveLabel: string }) {
  const [done, setDone] = useState<{ label: string; href?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (done) return <p role="status" className="text-sm font-medium">{done.label}{done.href ? <> · <Link href={done.href} className="text-primary hover:underline">Aç</Link></> : null}</p>;
  const go = async (a: 'approve' | 'reject') => {
    const r = await decide(id, version, a);
    if (r.ok) setDone({ label: a === 'approve' ? 'Taslak oluşturuldu' : 'Vazgeçildi', href: r.data?.result?.href }); else setError(r.error || 'Karar kaydedilemedi');
  };
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <button type="button" className="rf-primary-button text-sm" onClick={() => void go('approve')}><Check size={14} aria-hidden /> {approveLabel}</button>
        <button type="button" className="rf-secondary-button text-sm" onClick={() => void go('reject')}><X size={14} aria-hidden /> Vazgeç</button>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
    </div>
  );
}

/**
 * "Girdiden kayıt": a pasted customer message becomes a quote draft, a supplier's offer becomes the
 * answer to our price request, a count list goes to the count import. Every value shows how sure the
 * reading is; nothing is written until "Onayla".
 */
export function ExtractPanel() {
  const [tab, setTab] = useState<'quote' | 'offer' | 'count'>('quote');
  return (
    <section className="rf-panel space-y-3 p-3" aria-label="Girdiden kayıt">
      <div className="flex flex-wrap items-center gap-2">
        <FileText size={16} className="text-primary" aria-hidden />
        <h2 className="text-sm font-semibold">Girdiden kayıt</h2>
        <div role="tablist" aria-label="Girdi türü" className="ml-auto flex gap-1">
          {([['quote', 'Mesajdan teklif'], ['offer', 'Tedarikçi teklifi'], ['count', 'Sayım listesi']] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} type="button" className={`rounded-full px-3 py-1 text-xs ${tab === k ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
      </div>
      {tab === 'quote' && <QuoteFromMessage />}
      {tab === 'offer' && <OfferToRfq />}
      {tab === 'count' && (
        <p className="text-sm">Sayım PDF’i satır satır okunur ve her satır ayrı onaylanır. <Link href="/inventory/count-import" className="text-primary hover:underline">Sayım listesi yükle</Link></p>
      )}
      <p className="text-xs text-muted-foreground"><span className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">Sarı</span> alanlar emin olunmayan ya da bulunamayan değerlerdir; onaylamadan önce kontrol edin.</p>
    </section>
  );
}

function QuoteFromMessage() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setBusy(true); setError(null); setResult(null);
    const r = await requestJson<QuoteResult>('/api/v1/ai/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'quote_request', text }) });
    if (r.ok && r.data) setResult(r.data); else setError(r.error || 'Mesaj okunamadı');
    setBusy(false);
  }
  return (
    <div className="space-y-2">
      <label className="block text-xs text-muted-foreground" htmlFor="extract-message">WhatsApp / e-posta metni</label>
      <textarea id="extract-message" className="rf-input min-h-28 w-full text-sm" value={text} onChange={(e) => setText(e.target.value)} maxLength={8000} placeholder="Müşterinin mesajını buraya yapıştırın" />
      <button type="button" className="rf-primary-button text-sm" disabled={busy || text.trim().length < 5} onClick={() => void submit()}>Teklif taslağı çıkar</button>
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {result?.type === 'need' && <p className="text-sm" role="note">{result.message}</p>}
      {result?.type === 'preview' && (
        <div className="space-y-2 rounded-lg border border-border p-2" aria-label="Teklif taslağı önizleme">
          <dl className="space-y-0.5">
            <FieldValue label="Müşteri" field={result.request.customer} />
            <FieldValue label="Telefon" field={result.request.phone} />
            {result.request.email && <FieldValue label="E-posta" field={result.request.email} />}
            <FieldValue label="Adres" field={result.request.address} />
          </dl>
          <ol className="space-y-1.5">
            {result.request.lines.map((l, i) => (
              <li key={i} className="rounded border border-border p-1.5">
                <p className="text-xs font-semibold">Kalem {i + 1}</p>
                <dl className="grid gap-0.5 sm:grid-cols-2">
                  <FieldValue label="Ürün" field={l.family} show={(v) => FAMILY[v] ?? v} />
                  <FieldValue label="Ölçü" field={l.widthMm && l.projectionMm ? { ...l.widthMm, confidence: l.widthMm.confidence === 'high' && l.projectionMm.confidence === 'high' ? 'high' : 'medium', value: `${l.widthMm.value / 1000} × ${l.projectionMm.value / 1000} m` } : null} />
                  <FieldValue label="Renk" field={l.color} />
                  <FieldValue label="Adet" field={l.quantity} />
                </dl>
              </li>
            ))}
          </ol>
          {result.request.notes.map((n) => <p key={n} className="flex items-start gap-1 text-xs text-amber-800 dark:text-amber-300"><TriangleAlert size={12} className="mt-0.5 shrink-0" aria-hidden /> {n}</p>)}
          <p className="text-xs text-muted-foreground">Fiyatlar boş gelir; teklif taslak olarak açılır, iletişim bilgileri iç nota yazılır. Müşteriye hiçbir şey gönderilmez.{result.usedModel ? ' Ürünleri model buldu (iletişim satırları gönderilmedi).' : ''}</p>
          <Decision id={result.suggestionId} version={result.version} approveLabel="Onayla, taslak teklif aç" />
        </div>
      )}
    </div>
  );
}

function OfferToRfq() {
  const [rfqs, setRfqs] = useState<Rfq[] | null>(null);
  const [rfqId, setRfqId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [text, setText] = useState('');
  const [pdf, setPdf] = useState<{ name: string; base64: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OfferResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void requestJson<{ available: boolean; rfqs: Rfq[] }>('/api/v1/purchases/rfqs').then((r) => setRfqs(r.ok && r.data ? r.data.rfqs.filter((x) => x.status === 'open') : []));
  }, []);
  const rfq = rfqs?.find((r) => r.id === rfqId);
  async function readFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 4_000_000) { setError('Dosya en fazla 4 MB olabilir'); return; }
    const buf = new Uint8Array(await f.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    setPdf({ name: f.name, base64: btoa(bin) });
  }
  async function submit() {
    setBusy(true); setError(null); setResult(null);
    const r = await requestJson<OfferResult>('/api/v1/ai/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'supplier_offer', rfqId, supplierId, ...(pdf ? { pdfBase64: pdf.base64 } : { text }) }) });
    if (r.ok && r.data) setResult(r.data); else setError(r.error || 'Teklif okunamadı');
    setBusy(false);
  }
  if (rfqs === null) return <p className="text-sm text-muted-foreground" role="status">Teklif istekleri alınıyor…</p>;
  if (!rfqs.length) return <p className="text-sm">Açık teklif isteği yok. <Link href="/purchases?tab=rfq" className="text-primary hover:underline">Teklif isteği oluştur</Link></p>;
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">Teklif isteği
          <select className="rf-input mt-1 w-full text-sm" value={rfqId} onChange={(e) => { setRfqId(e.target.value); setSupplierId(''); }}>
            <option value="">Seçin</option>
            {rfqs.map((r) => <option key={r.id} value={r.id}>{r.number}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">Tedarikçi
          <select className="rf-input mt-1 w-full text-sm" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} disabled={!rfq}>
            <option value="">Seçin</option>
            {rfq?.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </div>
      <label className="rf-secondary-button inline-flex cursor-pointer text-xs"><Upload size={14} aria-hidden /> {pdf ? pdf.name : 'Teklif PDF’i seç'}
        <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => void readFile(e.target.files?.[0])} />
      </label>
      {!pdf && <textarea aria-label="Teklif metni" className="rf-input min-h-24 w-full text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder="…ya da tedarikçinin e-postasını yapıştırın" />}
      <button type="button" className="rf-primary-button text-sm" disabled={busy || !rfqId || !supplierId || (!pdf && text.trim().length < 5)} onClick={() => void submit()}>Fiyatları çıkar</button>
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {result?.type === 'need' && <p className="text-sm" role="note">{result.message}</p>}
      {result?.type === 'preview' && (
        <div className="space-y-2 rounded-lg border border-border p-2" aria-label="Tedarikçi cevabı önizleme">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Kalem</th><th>Miktar</th><th>Birim fiyat</th><th>Güven</th></tr></thead>
            <tbody>
              {result.lines.map((l) => {
                const p = result.offer.prices.find((x) => x.lineId === l.lineId);
                const weak = !p || p.unitPrice === null || p.confidence !== 'high';
                return (
                  <tr key={l.lineId} className={`border-t border-border ${weak ? 'bg-amber-100 dark:bg-amber-900/40' : ''}`} data-confidence={p?.unitPrice === null ? 'missing' : p?.confidence}>
                    <td className="py-1" title={p?.evidence ?? undefined}>{l.name}</td>
                    <td className="tabular-nums">{l.quantity}</td>
                    <td className="tabular-nums">{p?.unitPrice != null ? `${p.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${result.currency}` : '—'}</td>
                    <td className="text-xs">{p?.unitPrice != null ? CONF[p.confidence] : 'Bulunamadı'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground">Teslim süresi: {result.offer.leadTimeDays != null ? `${result.offer.leadTimeDays} gün` : '—'} · Geçerlilik: {result.offer.validUntil ?? '—'}. Bulunamayan kalemler cevaba yazılmaz.</p>
          <Decision id={result.suggestionId} version={result.version} approveLabel="Onayla, cevabı kaydet" />
        </div>
      )}
    </div>
  );
}
