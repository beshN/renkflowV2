'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { requestJson } from '@/lib/shared/network';
import { readTextFile } from '@/lib/shared/read-text-file';
import { SkeletonRows } from '@/components/kit';

type Recipe = { id: string; code: string; name: string; version: number; status: string; rule_count: number; example_count: number; created_at: string };
type Family = { key: string; label: string; profileCodes: string[]; recipes: Recipe[] };
type Overview = { available: boolean; canImport: boolean; families: Family[]; finishedItems: Array<{ id: string; sku: string; name: string }> };
type Summary = { materials: number; profiles: number; parameters: number; operations: number; checks: number; skipped: number; limits: Record<string, number> };
type Result = { ok: true; dryRun: boolean; summary: Summary; recipe?: { id: string; code: string; version: number } } | { ok: false; errors: string[] };

const STATUS: Record<string, string> = { draft: 'Taslak (örnekler bekleniyor)', published: 'Yayında', archived: 'Arşiv' };


export default function ProductsPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [family, setFamily] = useState('pergola');
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await requestJson<Overview>('/api/v1/products/recipes');
    if (r.ok && r.data) setData(r.data);
    else setError(r.error || 'Ürün reçeteleri alınamadı');
  }, []);
  useEffect(() => { void load(); }, [load]);

  const send = async (form: HTMLFormElement, dryRun: boolean) => {
    if (!file) return setError('Doldurulmuş şablonu seçin');
    const f = new FormData(form);
    setBusy(true);
    setError('');
    try {
      const r = await requestJson<Result>('/api/v1/products/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family, code: f.get('code'), name: f.get('name'), finishedItemId: f.get('finishedItemId'), fileName: file.name, text: file.text,verificationSource:f.get('verificationSource')||undefined, dryRun }),
      }, { timeoutMs: 60000, fallbackError: 'Reçete okunamadı' });
      if (!r.ok || !r.data) return setError(r.error || 'Reçete okunamadı');
      setResult(r.data);
      if (r.data.ok && !r.data.dryRun) await load();
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <main className="rf-page">{error ? <p role="alert">{error}</p> : <SkeletonRows rows={6} />}</main>;
  return (
    <main className="rf-page space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="rf-eyebrow">ÜRÜN · REÇETE</p>
          <h1 className="rf-page-title">Ürün aileleri ve reçeteler</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Reçete, ölçüden malzeme listesini (hangi profilden kaç parça, hangi boyda) çıkaran firma kuralıdır. Şablon, ailenin
            sayım listesindeki profil kartlarıyla gelir; formülleri siz doldurursunuz. Yüklenen reçete taslak olur; en az iki
            örnek ölçüyle doğrulanmadan yayınlanmaz ve teklifte kullanılmaz.
          </p>
        </div>
        <Link className="rf-secondary-button" href="/quotations/price-matrix">Fiyat matrisi</Link>
      </div>
      {!data.available && <p className="text-sm text-muted-foreground">Bu kurulumda ürün reçeteleri henüz etkin değil (veritabanı güncellemesi bekleniyor).</p>}

      {data.families.map((f) => (
        <section key={f.key} className="rf-panel space-y-3" aria-label={f.label}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{f.label}</h2>
            {data.canImport && <a className="text-sm underline" href={`/api/v1/products/recipes?template=${f.key}`}>Reçete şablonunu indir (CSV)</a>}
          </div>
          <p className="text-xs text-muted-foreground">Profil kodları (sayım listesi): {f.profileCodes.join(', ')}</p>
          {f.recipes.length ? (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead><tr>{['Kod', 'Ad', 'Sürüm', 'Malzeme satırı', 'Örnek', 'Durum'].map((h) => <th key={h} className="p-2 text-xs text-muted-foreground">{h}</th>)}</tr></thead>
              <tbody>
                {f.recipes.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-2">{r.code}</td><td className="p-2">{r.name}</td><td className="p-2">{r.version}</td><td className="p-2">{r.rule_count}</td><td className="p-2">{r.example_count}</td>
                    <td className="p-2"><Link className="underline" href="/production?tab=recipes">{STATUS[r.status] ?? r.status}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            <p className="text-sm text-amber-700 dark:text-amber-300">Bu ailenin reçetesi yok; teklifte malzeme listesi çıkarılamaz.</p>
          )}
        </section>
      ))}

      {data.canImport && data.available && (
        <section className="rf-panel space-y-3" aria-label="Reçete yükle">
          <h2 className="font-semibold">Doldurulmuş reçete şablonunu yükle</h2>
          <form className="grid gap-3 sm:grid-cols-2" onChange={() => setResult(null)} onSubmit={(e) => { e.preventDefault(); void send(e.currentTarget, true); }}>
            <label className="block text-xs">Ürün ailesi
              <select className="rf-input mt-2 w-full" value={family} onChange={(e) => { setFamily(e.target.value); setResult(null); }}>
                {data.families.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </label>
            <label className="block text-xs">Mamul kartı (reçetenin çıktısı)
              <select name="finishedItemId" required className="rf-input mt-2 w-full">
                <option value="">Seçin</option>
                {data.finishedItems.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
              </select>
            </label>
            <label className="block text-xs">Reçete kodu (fiyat matrisinde varyant)<input name="code" required className="rf-input mt-2 w-full" placeholder="ör. PERGOLA-CIFT-RAY" /></label>
            <label className="block text-xs">Reçete adı<input name="name" required className="rf-input mt-2 w-full" /></label>
            <label className="block text-xs sm:col-span-2">Doğrulanan teknik kaynak<input name="verificationSource" required={['wind-manual','wind-piston','giyotin'].includes(family)} minLength={5} maxLength={1000} className="rf-input mt-2 w-full" placeholder="Üretici çizimi, teknik belge ve sürümü"/></label>
            <label className="block text-xs sm:col-span-2">CSV dosyası (en fazla 1 MB)
              <input type="file" accept=".csv,text/csv" className="rf-input mt-2 w-full" onChange={async (e) => {
                const f = e.target.files?.[0];
                setResult(null);
                setError('');
                setFile(null);
                if (!f) return;
                if (f.size > 1_000_000) return setError('Dosya en fazla 1 MB olabilir');
                setFile({ name: f.name, text: await readTextFile(f) });
              }} />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button className="rf-secondary-button" disabled={busy || !file}>{busy ? 'Okunuyor…' : 'Önizle'}</button>
              {result?.ok && result.dryRun && (
                <button type="button" className="rf-primary-button" disabled={busy} onClick={(e) => void send(e.currentTarget.form!, false)}>Taslak reçete olarak kaydet</button>
              )}
            </div>
          </form>
          {result && !result.ok && (
            <div role="alert" className="text-sm text-rose-700 dark:text-rose-300">
              <p className="font-medium">Reçete kaydedilmedi; şu satırları düzeltin:</p>
              <ul className="mt-1 list-disc pl-5">{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}
          {result?.ok && (
            <p role="status" className="text-sm">
              {result.summary.materials} malzeme satırı ({result.summary.profiles} profil), {result.summary.parameters} seçenek, {result.summary.operations} operasyon, {result.summary.checks} kontrol
              {result.summary.skipped ? `; ${result.summary.skipped} boş satır reçeteye alınmadı` : ''}. En {result.summary.limits.minWidthMm}–{result.summary.limits.maxWidthMm} mm, açılım {result.summary.limits.minProjectionMm}–{result.summary.limits.maxProjectionMm} mm.
              {!result.dryRun && result.recipe && <> Taslak kaydedildi: {result.recipe.code} sürüm {result.recipe.version}. <Link className="underline" href="/production?tab=recipes">Örnekleri girip yayınlayın</Link>.</>}
            </p>
          )}
        </section>
      )}
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    </main>
  );
}
