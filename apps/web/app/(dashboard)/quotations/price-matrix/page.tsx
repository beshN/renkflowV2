'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { requestJson } from '@/lib/shared/network';

type Summary = { id: string; family: string; currency: string; status: string; file_name: string | null; base_count: number; option_count: number; created_at: string; imported_by_name: string | null };
type Overview = { available: boolean; canImport: boolean; families: Array<{ key: string; label: string; active: Summary | null }>; history: Summary[] };
type BaseRow = { row: number; variant: string; minA: number; maxA: number; minB: number; maxB: number; basis: string; unitPrice: number };
type OptionRow = { row: number; variant: string; option: string; basis: string; unitPrice: number };
type Preview = { ok: true; dryRun: boolean; summary: { currency: string; base: number; options: number }; matrix?: { base: BaseRow[]; options: OptionRow[] } } | { ok: false; errors: string[] };
type Check = { status: 'priced'; currency: string; unitPrice: number; lines: Array<{ label: string; amount: number }>; unpricedOptions: string[] } | { status: 'not_covered' | 'no_matrix'; message: string };

const money = (n: number, currency: string) => n.toLocaleString('tr-TR', { style: 'currency', currency });

/** Excel in Turkish saves CSV either as UTF-8 or as Windows-1254; read whichever this file is. */
async function readText(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1254').decode(bytes);
  }
}

export default function PriceMatrixPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [family, setFamily] = useState('pergola');
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [check, setCheck] = useState<Check | null>(null);

  const load = useCallback(async () => {
    const r = await requestJson<Overview>('/api/v1/products/price-matrix');
    if (r.ok && r.data) setData(r.data);
    else setError(r.error || 'Fiyat matrisi alınamadı');
  }, []);
  useEffect(() => { void load(); }, [load]);

  const send = async (dryRun: boolean) => {
    if (!file) return;
    setBusy(true);
    setError('');
    setDone('');
    const r = await requestJson<Preview>('/api/v1/products/price-matrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'import', family, fileName: file.name, text: file.text, dryRun }),
    }, { timeoutMs: 60000, fallbackError: 'Dosya okunamadı' });
    setBusy(false);
    if (!r.ok || !r.data) return setError(r.error || 'Dosya okunamadı');
    if (dryRun) return setPreview(r.data);
    if (r.data.ok) {
      const replaced = Boolean(data?.families.find((f) => f.key === family)?.active);
      await load();
      setPreview(null);
      setFile(null);
      setDone(replaced ? 'Fiyat matrisi etkinleştirildi; önceki matris arşive alındı.' : 'Fiyat matrisi etkinleştirildi.');
    } else setPreview(r.data);
  };

  if (!data) return <main className="rf-page"><p role={error ? 'alert' : 'status'}>{error || 'Yükleniyor…'}</p></main>;
  const current = data.families.find((f) => f.key === family);

  return (
    <main className="rf-page space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="rf-eyebrow">TEKLİF · FİYAT</p>
          <h1 className="rf-page-title">Fiyat matrisi</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Fiyatlar firmanın kendi dosyasından gelir; sistem fiyat önermez. Matris yokken ya da ölçü matrisin dışındayken
            teklifte fiyat elle girilir ve &quot;fiyat matrisi tanımlı değil&quot; olarak işaretlenir.
          </p>
        </div>
        <Link className="rf-secondary-button" href="/quotations">Tekliflere dön</Link>
      </div>
      {!data.available && <p className="text-sm text-muted-foreground">Bu kurulumda fiyat matrisi henüz etkin değil (veritabanı güncellemesi bekleniyor); teklifler elle fiyatlanır.</p>}

      <section className="grid gap-3 sm:grid-cols-2" aria-label="Ürün aileleri">
        {data.families.map((f) => (
          <div key={f.key} className="rf-panel space-y-2">
            <h2 className="font-semibold">{f.label}</h2>
            {f.active ? (
              <p className="text-sm">{f.active.base_count} ölçü kademesi, {f.active.option_count} opsiyon · {f.active.currency} · {new Date(f.active.created_at).toLocaleDateString('tr-TR')} {f.active.imported_by_name ? `· ${f.active.imported_by_name}` : ''}</p>
            ) : (
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Fiyat matrisi tanımlı değil</p>
            )}
            <a className="text-sm underline" href={`/api/v1/products/price-matrix?template=${f.key}`}>Boş şablonu indir (CSV)</a>
          </div>
        ))}
      </section>

      {data.canImport && data.available && (
        <section className="rf-panel space-y-3" aria-label="Matris yükle">
          <h2 className="font-semibold">Doldurulmuş şablonu yükle</h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <label className="block text-xs">Ürün ailesi
              <select className="rf-input mt-2 w-full" value={family} onChange={(e) => { setFamily(e.target.value); setPreview(null); }}>
                {data.families.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </label>
            <label className="block text-xs">CSV dosyası (en fazla 1 MB)
              <input type="file" accept=".csv,text/csv" className="rf-input mt-2 w-full" onChange={async (e) => {
                const f = e.target.files?.[0];
                setPreview(null);
                setDone('');
                if (!f) return setFile(null);
                if (f.size > 1_000_000) return setError('Dosya en fazla 1 MB olabilir');
                setFile({ name: f.name, text: await readText(f) });
              }} />
            </label>
            <button className="rf-secondary-button" disabled={!file || busy} onClick={() => send(true)}>{busy ? 'Okunuyor…' : 'Önizle'}</button>
          </div>
          {preview && !preview.ok && (
            <div role="alert" className="text-sm text-rose-700 dark:text-rose-300">
              <p className="font-medium">Dosya yüklenmedi; şu satırları düzeltin:</p>
              <ul className="mt-1 list-disc pl-5">{preview.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}
          {preview && preview.ok && preview.matrix && (
            <div className="space-y-3">
              <p className="text-sm">{preview.summary.base} ölçü kademesi, {preview.summary.options} opsiyon · {preview.summary.currency}. {current?.active ? 'Etkinleştirince mevcut matris arşive alınır.' : ''}</p>
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr>{['Satır', 'Varyant', 'En (mm)', 'Açılım (mm)', 'Esas', 'Birim fiyat'].map((h) => <th key={h} className="p-2 text-xs text-muted-foreground">{h}</th>)}</tr></thead>
                  <tbody>
                    {preview.matrix.base.map((r) => (
                      <tr key={r.row} className="border-t border-border"><td className="p-2">{r.row}</td><td className="p-2">{r.variant}</td><td className="p-2">{r.minA}–{r.maxA}</td><td className="p-2">{r.minB}–{r.maxB}</td><td className="p-2">{r.basis}</td><td className="p-2">{money(r.unitPrice, preview.summary.currency)}</td></tr>
                    ))}
                    {preview.matrix.options.map((r) => (
                      <tr key={r.row} className="border-t border-border"><td className="p-2">{r.row}</td><td className="p-2">{r.variant}</td><td className="p-2" colSpan={2}>Opsiyon: {r.option}</td><td className="p-2">{r.basis}</td><td className="p-2">{money(r.unitPrice, preview.summary.currency)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="rf-primary-button" disabled={busy} onClick={() => send(false)}>Bu matrisi etkinleştir</button>
            </div>
          )}
        </section>
      )}
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {done && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{done}</p>}

      <section className="rf-panel space-y-3" aria-label="Fiyat dene">
        <h2 className="font-semibold">Fiyatı dene</h2>
        <form className="grid gap-3 sm:grid-cols-5 sm:items-end" onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const options = Object.fromEntries(String(form.get('options') || '').split(',').map((s) => s.trim()).filter(Boolean).map((k) => [k, true]));
          const r = await requestJson<Check>('/api/v1/products/price-matrix', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'check', family, variant: String(form.get('variant') || '*'), a: Number(form.get('a')), b: Number(form.get('b')), options }),
          });
          if (r.ok && r.data) setCheck(r.data);
          else setError(r.error || 'Fiyat hesaplanamadı');
        }}>
          <label className="block text-xs">Varyant (reçete kodu)<input name="variant" className="rf-input mt-2 w-full" placeholder="*" /></label>
          <label className="block text-xs">En (mm)<input name="a" required inputMode="numeric" className="rf-input mt-2 w-full" /></label>
          <label className="block text-xs">Açılım (mm)<input name="b" required inputMode="numeric" className="rf-input mt-2 w-full" /></label>
          <label className="block text-xs">Opsiyonlar (virgülle)<input name="options" className="rf-input mt-2 w-full" placeholder="motor, led" /></label>
          <button className="rf-secondary-button">Hesapla</button>
        </form>
        {check && (check.status === 'priced' ? (
          <div className="text-sm">
            <p className="font-semibold">Birim fiyat: {money(check.unitPrice, check.currency)}</p>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">{check.lines.map((l) => <li key={l.label}>{l.label}: {money(l.amount, check.currency)}</li>)}</ul>
            {check.unpricedOptions.length > 0 && <p className="mt-1 text-amber-700 dark:text-amber-300">Matriste fiyatı olmayan opsiyon: {check.unpricedOptions.join(', ')} (fiyata eklenmedi)</p>}
          </div>
        ) : (
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">{check.message}</p>
        ))}
      </section>
    </main>
  );
}
