'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { requestJson } from '@/lib/shared/network';
import { ColorPicker } from '@/components/colors/ColorPicker';
import { ColorChip } from '@/components/colors/ColorSwatch';
import { colorKey } from '@/lib/features/colors/color-spec';

type Catalog = { available: boolean; colors: string[]; starter: string[] };

/**
 * The firm's frequently used colours: shown first in the colour picker, in the firm's order. They do
 * not limit quotes; every RAL colour can be chosen.
 */
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
      } else setError(r.error || 'Sık kullanılan renkler alınamadı');
    });
  }, []);

  const change = (next: string[]) => {
    setColors(next);
    setDone('');
    setError('');
  };
  const add = () => {
    if (!draft) return;
    if (colors.some((c) => colorKey(c) === colorKey(draft))) return setError(`"${draft}" zaten listede`);
    change([...colors, draft]);
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
      <h2 id="color-catalog-title" className="text-lg font-semibold">Sık kullanılan renkler</h2>
      <p className="text-sm text-muted-foreground">
        Renk seçicide en üstte çıkar. Teklifte bütün RAL renkleri seçilebilir; bu liste boş da olabilir.
        Eski yazımlar (ör. 7016 MAT) kayıtta &quot;RAL 7016 Mat&quot; olarak düzelir; stok eşleşmesi iki yazımı aynı renk sayar.
      </p>
      {!data.available ? (
        <p className="text-sm text-muted-foreground">Bu ayar bu kurulumda henüz etkin değil (veritabanı güncellemesi bekleniyor).</p>
      ) : (
        <>
          {!colors.length && (
            <div className="rounded-md border border-border p-3 text-sm">
              <p>Liste boş. Firmanın verdiği başlangıç listesi: {data.starter.join(', ')}.</p>
              <button type="button" className="rf-secondary-button mt-2" onClick={() => change([...data.starter])}>Başlangıç listesini ekle</button>
            </div>
          )}
          <ol className="space-y-1" aria-label="Renkler">
            {colors.map((c, i) => (
              <li key={i} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <span className="w-6 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <ColorChip color={c} size={20} showName className="flex-1" />
                <button type="button" className="rf-icon-button" aria-label={`${c} yukarı`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={15} /></button>
                <button type="button" className="rf-icon-button" aria-label={`${c} aşağı`} disabled={i === colors.length - 1} onClick={() => move(i, 1)}><ArrowDown size={15} /></button>
                <button type="button" className="rf-icon-button" aria-label={`${c} sil`} onClick={() => change(colors.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
              </li>
            ))}
          </ol>
          <div className="space-y-2 rounded-md border border-border p-3">
            <ColorPicker label="Listeye eklenecek renk" value={draft} onChange={setDraft} />
            <button type="button" className="rf-secondary-button" disabled={!draft} onClick={add}>Listeye ekle</button>
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
                  setDone('Sık kullanılan renkler kaydedildi.');
                } else setError(r.error || 'Kaydedilemedi');
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Kaydediliyor…' : 'Listeyi kaydet'}
          </button>
        </>
      )}
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {done && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{done}</p>}
    </section>
  );
}
