'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { requestJson } from '@/lib/shared/network';
import { readTextFile } from '@/lib/shared/read-text-file';
import { SkeletonRows } from '@/components/kit';

type Recipe = { id: string; code: string; name: string; version: number; status: string; rule_count: number; example_count: number; created_at: string };
type Family = { key: string; label: string; profileCodes: string[]; recipes: Recipe[] };
type Overview = { available: boolean; canImport: boolean; canCreateCards: boolean; families: Family[]; finishedItems: Array<{ id: string; sku: string; name: string }> };
type Summary = { materials: number; profiles: number; parameters: number; operations: number; checks: number; skipped: number; limits: Record<string, number> };
type Result = { ok: true; dryRun: boolean; summary: Summary; previewHash: string; recipe?: { id: string; code: string; version: number } } | { ok: false; errors: string[] };

const STATUS: Record<string, string> = { draft: 'Taslak (örnekler bekleniyor)', published: 'Yayında', archived: 'Arşiv' };


export default function ProductsPage() {
  const lock = useRef(false);
  const fileSequence = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; fileSequence.current++; }; }, []);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [family, setFamily] = useState('pergola');
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await requestJson<Overview>('/api/v1/products/recipes');
    if (!mounted.current) return;
    if (r.ok && r.data) setData(r.data);
    else setError(r.error || 'Ürün reçeteleri alınamadı');
  }, []);
  useEffect(() => { void load(); }, [load]);

  const send = async (form: HTMLFormElement, dryRun: boolean) => {
    if (lock.current) return;
    if (!file) return setError('Doldurulmuş şablonu seçin');
    if (!dryRun && !(result?.ok && result.dryRun)) return setError('Dosyayı önce önizleyin');
    const f = new FormData(form);
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const r = await requestJson<Result>('/api/v1/products/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family, code: f.get('code'), name: f.get('name'), finishedItemId: f.get('finishedItemId'), fileName: file.name, text: file.text, dryRun, ...(!dryRun && result?.ok ? { previewHash: result.previewHash } : {}) }),
      }, { timeoutMs: 60000, fallbackError: 'Reçete okunamadı' });
      if (!mounted.current) return;
      if (!r.ok || !r.data) { setResult(null); return setError(r.error || 'Reçete okunamadı'); }
      setResult(r.data);
      if (r.data.ok && !r.data.dryRun) await load();
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  if (!data) return <div className="rf-page">{error ? <p role="alert">{error}</p> : <SkeletonRows rows={6} />}</div>;
  return (
    <div className="rf-page space-y-5">
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
        <div className="flex flex-wrap gap-2">{data.canCreateCards && <Link className="rf-secondary-button" href="/products/import">Ürün kartlarını içe aktar</Link>}<Link className="rf-secondary-button" href="/quotations/price-matrix">Fiyat matrisi</Link></div>
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
            <><div className="hidden overflow-x-auto sm:block"><table className="w-full text-left text-sm">
              <thead><tr>{['Kod', 'Ad', 'Sürüm', 'Malzeme satırı', 'Örnek', 'Durum'].map((h) => <th key={h} className="p-2 text-xs text-muted-foreground">{h}</th>)}</tr></thead>
              <tbody>
                {f.recipes.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-2">{r.code}</td><td className="p-2">{r.name}</td><td className="p-2">{r.version}</td><td className="p-2">{r.rule_count}</td><td className="p-2">{r.example_count}</td>
                    <td className="p-2"><Link className="underline" href="/production?tab=recipes">{STATUS[r.status] ?? r.status}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <div className="space-y-2 sm:hidden">{f.recipes.map((r) => <article key={r.id} className="space-y-1 rounded-lg border border-border p-3 break-words">
              <p className="text-xs text-muted-foreground">{r.code} · Sürüm {r.version}</p><p className="font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.rule_count} malzeme satırı · {r.example_count} örnek</p>
              <Link className="text-sm underline" href="/production?tab=recipes">{STATUS[r.status] ?? r.status}</Link>
            </article>)}</div></>
          ) : (
            <p className="text-sm text-amber-700 dark:text-amber-300">Bu ailenin reçetesi yok; teklifte malzeme listesi çıkarılamaz.</p>
          )}
        </section>
      ))}

      {data.canImport && data.available && (
        <section className="rf-panel space-y-3" aria-label="Reçete yükle">
          <h2 className="font-semibold">Doldurulmuş reçete şablonunu yükle</h2>
          <form className="grid gap-3 sm:grid-cols-2" onChange={() => { setResult(null); setError(''); }} onSubmit={(e) => { e.preventDefault(); void send(e.currentTarget, true); }}>
            <fieldset disabled={busy} className="contents">
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
            <label className="block text-xs sm:col-span-2">CSV dosyası (en fazla 1 MB)
              <input type="file" accept=".csv,text/csv" className="rf-input mt-2 w-full" onChange={async (e) => {
                const sequence = ++fileSequence.current;
                const f = e.target.files?.[0];
                setResult(null);
                setError('');
                setFile(null);
                if (!f) return;
                if (f.size > 1_000_000) return setError('Dosya en fazla 1 MB olabilir');
                try {
                  const text = await readTextFile(f);
                  if (mounted.current && sequence === fileSequence.current) setFile({ name: f.name, text });
                } catch { if (mounted.current && sequence === fileSequence.current) setError('CSV dosyası okunamadı'); }
              }} />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button className="rf-secondary-button" disabled={busy || !file}>{busy ? 'Okunuyor…' : 'Önizle'}</button>
              {result?.ok && result.dryRun && (
                <button type="button" className="rf-primary-button" disabled={busy} onClick={(e) => void send(e.currentTarget.form!, false)}>Taslak reçete olarak kaydet</button>
              )}
            </div>
            </fieldset>
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
    </div>
  );
}
