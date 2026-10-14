'use client';

import { ChangeEvent, useState } from 'react';
import Link from 'next/link';
import { Download, FileUp } from 'lucide-react';
import { StatusChip, type Tone } from '@/components/kit';
import { CUSTOMER_IMPORT_TEMPLATE } from '@/lib/features/customers/import';
import { requestJson } from '@/lib/shared/network';

type Outcome = 'new' | 'exists' | 'fill' | 'name_match' | 'error';
type Result = {
  dryRun: boolean; columns: Record<string, string>; ignored: string[];
  summary: { new: number; exists: number; filled: number; nameMatches: number; errors: number };
  rows: Array<{ line: number; name: string; outcome: Outcome; matchedId?: string; filled?: string[]; errors?: string[] }>;
};
const OUTCOME: Record<Outcome, { label: string; tone: Tone }> = {
  new: { label: 'Yeni kart', tone: 'success' },
  exists: { label: 'Zaten kayıtlı · atlanır', tone: 'neutral' },
  fill: { label: 'Kayıtlı · boş alanlar doldurulur', tone: 'info' },
  name_match: { label: 'Aynı adlı kart var', tone: 'warning' },
  error: { label: 'Hatalı', tone: 'danger' },
};
const FIELD_LABELS: Record<string, string> = { fullName: 'Ad', companyName: 'Firma', phone: 'Telefon', email: 'E-posta', taxNumber: 'VKN/TCKN', taxOffice: 'Vergi dairesi', address: 'Adres', city: 'İl', district: 'İlçe', notes: 'Not' };

/** Customer list import: pick a CSV, see what each row will do, then import. Nothing is written before confirmation. */
export function CustomerImportWizard() {
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [options, setOptions] = useState({ fillEmpty: true, includeNameMatches: false });
  const [preview, setPreview] = useState<Result | null>(null);
  const [done, setDone] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(body: { text: string; dryRun: boolean; fillEmpty: boolean; includeNameMatches: boolean }) {
    setBusy(true);
    setError('');
    const r = await requestJson<Result>('/api/v1/customers/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, { timeoutMs: 120_000 });
    setBusy(false);
    if (!r.ok || !r.data) { setError(r.error || 'Dosya işlenemedi'); return null; }
    return r.data;
  }

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setPreview(null);
    setDone(null);
    if (!file) return;
    if (file.size > 2_000_000) { setError('Dosya 2 MB sınırını aşıyor'); return; }
    const buffer = await file.arrayBuffer();
    let content = new TextDecoder('utf-8').decode(buffer);
    if (content.includes('�')) content = new TextDecoder('windows-1254').decode(buffer);
    setText(content);
    setFileName(file.name);
    setPreview(await run({ text: content, dryRun: true, ...options }));
  }

  async function changeOption(next: typeof options) {
    setOptions(next);
    if (text) setPreview(await run({ text, dryRun: true, ...next }));
  }

  async function confirm() {
    if (!text) return;
    const result = await run({ text, dryRun: false, ...options });
    if (result) { setDone(result); setPreview(null); setText(null); }
  }

  const template = `data:text/csv;charset=utf-8,${encodeURIComponent('﻿' + CUSTOMER_IMPORT_TEMPLATE)}`;
  const shown = preview ?? done;

  return (
    <div className="space-y-4">
      <section className="rf-panel space-y-3 p-4">
        <p className="text-sm text-muted-foreground">Excel ya da başka bir programdan aldığınız müşteri listesini CSV olarak kaydedip yükleyin. Başlıklar otomatik tanınır (Ad Soyad, Firma, Telefon, E-posta, VKN/TCKN, Vergi Dairesi, Adres, İl, İlçe, Not). Vergi numarası, e-posta ya da telefonu kayıtlı bir müşteriyle eşleşen satırdan yeni kart açılmaz.</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="rf-primary-button inline-flex cursor-pointer items-center gap-2 text-sm">
            <FileUp size={14} aria-hidden /> CSV dosyası seç
            <input type="file" accept=".csv,.txt" className="sr-only" disabled={busy} onChange={(e) => void pick(e)} />
          </label>
          <a href={template} download="musteri-listesi-sablon.csv" className="rf-secondary-button inline-flex items-center gap-1 text-sm"><Download size={14} aria-hidden /> Şablon</a>
          {fileName && <span className="text-sm">{fileName}</span>}
        </div>
        <fieldset className="flex flex-wrap gap-4 text-sm" disabled={busy}>
          <legend className="sr-only">Seçenekler</legend>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={options.fillEmpty} onChange={(e) => void changeOption({ ...options, fillEmpty: e.target.checked })} /> Kayıtlı müşterilerin boş alanlarını doldur (dolu alanlar değişmez)</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={options.includeNameMatches} onChange={(e) => void changeOption({ ...options, includeNameMatches: e.target.checked })} /> Yalnız adı aynı olanlar için de yeni kart aç</label>
        </fieldset>
        {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      </section>

      {shown && (
        <section className="rf-panel space-y-3 p-4" aria-labelledby="import-result">
          <h2 id="import-result" className="rf-section-title">{done ? 'Aktarım tamamlandı' : 'Önizleme: henüz bir şey kaydedilmedi'}</h2>
          <p className="text-sm">
            {shown.summary.new} yeni kart · {shown.summary.exists} zaten kayıtlı · {shown.summary.filled} kartın boş alanı doldurulacak · {shown.summary.nameMatches} aynı adlı · {shown.summary.errors} hatalı satır
          </p>
          <p className="text-xs text-muted-foreground">Tanınan sütunlar: {Object.entries(shown.columns).map(([f, h]) => `${h} → ${FIELD_LABELS[f] ?? f}`).join(', ')}{shown.ignored.length ? ` · Kullanılmayan: ${shown.ignored.join(', ')}` : ''}</p>
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-2">Satır</th><th className="p-2">Ad</th><th className="p-2">Sonuç</th><th className="p-2">Ayrıntı</th></tr></thead>
              <tbody>
                {shown.rows.map((r) => (
                  <tr key={r.line} className="border-t border-border">
                    <td className="p-2 tabular-nums">{r.line}</td>
                    <td className="p-2">{r.name || '—'}</td>
                    <td className="p-2"><StatusChip tone={OUTCOME[r.outcome].tone} label={OUTCOME[r.outcome].label} /></td>
                    <td className="p-2 text-xs">
                      {r.errors?.join('; ')}
                      {r.filled && `Doldurulacak: ${r.filled.join(', ')}`}
                      {r.matchedId && <> {' '}<Link href={`/crm/${r.matchedId}`} className="text-primary underline">kayıtlı kart</Link></>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview && (
            <button type="button" className="rf-primary-button text-sm" disabled={busy || preview.summary.new + preview.summary.filled === 0} onClick={() => void confirm()}>
              {busy ? 'Aktarılıyor…' : `${preview.summary.new} yeni kart aç${preview.summary.filled ? `, ${preview.summary.filled} kartı tamamla` : ''}`}
            </button>
          )}
          {done && <Link href="/crm" className="rf-secondary-button inline-block text-sm">Müşteri listesine dön</Link>}
        </section>
      )}
    </div>
  );
}
