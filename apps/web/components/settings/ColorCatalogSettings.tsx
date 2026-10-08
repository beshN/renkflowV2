'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { requestJson } from '@/lib/shared/network';

type Catalog = { available: boolean; colors: string[]; starter: string[] };

/** The firm's colour catalogue: the colours quotes are made in, in the firm's order. */
export function ColorCatalogSettings() {
  const [data, setData] = useState<Catalog | null>(null);
  const [colors, setColors] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void requestJson<Catalog>('/api/v1/settings/colors').then((r) => {
      if (r.ok && r.data) {
        setData(r.data);
        setColors(r.data.colors);
      } else setError(r.error || 'Renk kataloğu alınamadı');
    });
  }, []);

  const change = (next: string[]) => {
    setColors(next);
    setDone('');
    setError('');
  };
  const add = () => {
    const name = draft.trim();
    if (!name) return;
    if (colors.some((c) => c.localeCompare(name, 'tr-TR', { sensitivity: 'base' }) === 0)) return setError(`"${name}" zaten listede`);
    change([...colors, name]);
    setDraft('');
  };
  const move = (i: number, by: number) => {
    const next = [...colors];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    change(next);
  };

  if (!data) return <p role={error ? 'alert' : 'status'} className="text-sm">{error || 'Yükleniyor…'}</p>;
  return (
    <section className="space-y-3" aria-labelledby="color-catalog-title">
      <h2 id="color-catalog-title" className="text-lg font-semibold">Renk kataloğu</h2>
      <p className="text-sm text-muted-foreground">
        Teklif yapılandırıcısı renkleri bu listeden sunar. Stok yalnız &quot;stokta var / yok&quot; bilgisidir; stokta olmayan renkte de teklif verilebilir.
        Renk adlarını sayım listesindeki gibi yazın (ör. 7016 Mat), stok eşleşmesi buna göre yapılır.
      </p>
      {!data.available ? (
        <p className="text-sm text-muted-foreground">Bu ayar bu kurulumda henüz etkin değil (veritabanı güncellemesi bekleniyor).</p>
      ) : (
        <>
          {!colors.length && (
            <div className="rounded-md border border-border p-3 text-sm">
              <p>Katalog boş. Başlangıç listesi: {data.starter.join(', ')}.</p>
              <button type="button" className="rf-secondary-button mt-2" onClick={() => change([...data.starter])}>Başlangıç listesini ekle</button>
            </div>
          )}
          <ol className="space-y-1" aria-label="Renkler">
            {colors.map((c, i) => (
              <li key={i} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <span className="w-6 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <input aria-label={`Renk ${i + 1}`} className="rf-input flex-1" value={c} maxLength={100} onChange={(e) => change(colors.map((x, j) => (j === i ? e.target.value : x)))} />
                <button type="button" className="rf-icon-button" aria-label={`${c} yukarı`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={15} /></button>
                <button type="button" className="rf-icon-button" aria-label={`${c} aşağı`} disabled={i === colors.length - 1} onClick={() => move(i, 1)}><ArrowDown size={15} /></button>
                <button type="button" className="rf-icon-button" aria-label={`${c} sil`} onClick={() => change(colors.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block flex-1 text-xs">Yeni renk
              <input className="rf-input mt-2 w-full" value={draft} maxLength={100} placeholder="ör. 7016 Mat" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
            </label>
            <button type="button" className="rf-secondary-button" onClick={add}>Ekle</button>
          </div>
          <button
            type="button"
            className="rf-primary-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                const r = await requestJson<{ colors: string[] }>('/api/v1/settings/colors', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ colors: colors.map((c) => c.trim()) }),
                });
                if (r.ok && r.data) {
                  setColors(r.data.colors);
                  setDone('Renk kataloğu kaydedildi.');
                } else setError(r.error || 'Kaydedilemedi');
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Kaydediliyor…' : 'Kataloğu kaydet'}
          </button>
        </>
      )}
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {done && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{done}</p>}
    </section>
  );
}
