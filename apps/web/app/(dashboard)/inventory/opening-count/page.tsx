'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { requestJson } from '@/lib/shared/network';
import { STATE_LABELS, type ProcessedState } from '@/lib/features/inventory/vocabulary';
import { ColorChip } from '@/components/colors/ColorSwatch';
import { SkeletonRows } from '@/components/kit';

type Line = { id: string; code: string | null; name: string; color: string | null; quantity: string; item_name: string; sku: string; processed_states: string[] | null; title: string | null; warehouse_id: string };
type Item = { id: string; sku: string; name: string; processed_states: string[] | null };
type Counted = { id: string; name: string; color: string | null; quantity: string; counted_meters: string; counted_bars: number; counted_at: string };
type Overview = { available: boolean; canCount?: boolean; lines: Line[]; items: Item[]; warehouses: Array<{ id: string; code: string; name: string }>; counted: Counted[] };
type Bar = { lengthMm: string; count: string };

const MAX_BARS = 1000;
const metres = (n: number) => `${n.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} m`;

export default function OpeningCountPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState('');
  const [itemId, setItemId] = useState('');
  const [color, setColor] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [bars, setBars] = useState<Bar[]>([{ lengthMm: '6000', count: '' }]);
  // One command key per entry, kept across retries so a lost response cannot post the bars twice.
  const [commandId, setCommandId] = useState(() => crypto.randomUUID());

  const load = useCallback(async () => {
    const r = await requestJson<Overview>('/api/v1/inventory/opening-count');
    if (r.ok && r.data) setData(r.data);
    else setError(r.error || 'Açılış sayımı alınamadı');
  }, []);
  useEffect(() => { void load(); }, [load]);

  const line = data?.lines.find((l) => l.id === target) ?? null;
  const item = data?.items.find((i) => i.id === itemId) ?? null;
  const entered = useMemo(() => bars.reduce((s, b) => s + (Number(b.lengthMm) || 0) * (Number(b.count) || 0), 0) / 1000, [bars]);
  const barCount = bars.reduce((s, b) => s + (Number(b.count) || 0), 0);
  // Unpainted profiles' bars are recorded as such; a list line that names its colour needs none.
  const unpainted = ((line ? line.processed_states : item?.processed_states) ?? []).includes('boyasiz');
  const needsColor = !unpainted && !line?.color && Boolean(line || item);

  if (!data) return <div className="rf-page">{error ? <p role="alert">{error}</p> : <SkeletonRows rows={6} />}</div>;
  if (!data.available) return <div className="rf-page"><h1 className="rf-page-title">Açılış sayımı</h1><p className="mt-3 text-sm text-muted-foreground">Bu kurulumda çubuk sayımı henüz etkin değil (veritabanı güncellemesi bekleniyor).</p></div>;

  const reset = () => { setBars([{ lengthMm: '6000', count: '' }]); setCommandId(crypto.randomUUID()); setTarget(''); setItemId(''); setColor(''); };

  return (
    <div className="rf-page space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="rf-eyebrow">STOK · SAYIM</p>
          <h1 className="rf-page-title">Çubuk bazında açılış sayımı</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Metreyle tutulan profiller rafta çubuk çubuk sayılır: hangi profilde, hangi renkte, hangi boyda kaç çubuk var.
            Her çubuk ayrı stok partisi olarak rengi ve boyuyla yazılır; kesim planı bu çubuklardan seçer.
          </p>
        </div>
        <Link className="rf-secondary-button" href="/inventory/count-import">Sayım listeleri</Link>
      </div>

      {data.canCount ? (
        <form
          className="rf-panel space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            setDone('');
            const rows = bars.filter((b) => b.lengthMm || b.count).map((b) => ({ lengthMm: Number(b.lengthMm), count: Number(b.count) }));
            if (!rows.length || rows.some((b) => !Number.isInteger(b.lengthMm) || b.lengthMm < 100 || b.lengthMm > 30000 || !Number.isInteger(b.count) || b.count < 1))
              return setError('Her satıra boyu (100–30000 mm) ve çubuk adedini tam sayı olarak girin');
            if (rows.reduce((s, b) => s + b.count, 0) > MAX_BARS) return setError(`Bir girişte en fazla ${MAX_BARS} çubuk; kalanını ayrı girin`);
            if (needsColor && !color.trim()) return setError('Çubukların rengini girin');
            setBusy(true);
            const r = await requestJson<{ data: { bars: number; countedMeters: number; differenceMeters: number | null } }>('/api/v1/inventory/opening-count', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ commandId, data: { ...(line ? { lineId: line.id } : { itemId, warehouseId }), color: needsColor ? color.trim() : undefined, bars: rows } }),
            }, { timeoutMs: 60000, fallbackError: 'Açılış sayımı kaydedilemedi' });
            setBusy(false);
            if (!r.ok || !r.data) return setError(r.error || 'Açılış sayımı kaydedilemedi');
            const d = r.data.data;
            setDone(`${d.bars} çubuk (${metres(d.countedMeters)}) stoğa yazıldı${d.differenceMeters == null ? '' : ` · listeye göre fark ${d.differenceMeters >= 0 ? '+' : ''}${metres(d.differenceMeters)}`}.`);
            reset();
            await load();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">Sayım listesinden bekleyen satır
              <select className="rf-input mt-2 w-full" value={target} onChange={(e) => { setTarget(e.target.value); setColor(''); }}>
                <option value="">Listede yok · malzeme seçeceğim</option>
                {data.lines.map((l) => <option key={l.id} value={l.id}>{l.item_name} · {l.color || 'renk yazmıyor'} · listede {metres(Number(l.quantity))}</option>)}
              </select>
              {line?.color && <ColorChip color={line.color} size={18} showName className="mt-2 text-sm" />}
            </label>
            {!line && (
              <>
                <label className="block text-xs">Malzeme (metre ile tutulan)
                  <select className="rf-input mt-2 w-full" value={itemId} onChange={(e) => { setItemId(e.target.value); setColor(''); }} required>
                    <option value="">Seçin</option>
                    {data.items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.sku}){i.processed_states?.length ? ` · ${i.processed_states.map((st) => STATE_LABELS[st as ProcessedState] ?? st).join(', ')}` : ''}</option>)}
                  </select>
                </label>
                <label className="block text-xs">Depo
                  <select className="rf-input mt-2 w-full" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
                    <option value="">Seçin</option>
                    {data.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                  </select>
                </label>
              </>
            )}
            {needsColor && (
              <label className="block text-xs">Renk (her çubukta tutulur)
                <input className="rf-input mt-2 w-full" value={color} onChange={(e) => setColor(e.target.value)} maxLength={100} placeholder="ör. 7016 Mat" />
                {color.trim() && <ColorChip color={color} size={18} showName className="mt-2 text-sm" />}
              </label>
            )}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs text-muted-foreground">Çubuklar: boy ve adet</legend>
            {bars.map((b, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <label className="text-xs">Boy (mm)<input aria-label={`Boy ${i + 1}`} className="rf-input mt-1 w-28" inputMode="numeric" value={b.lengthMm} onChange={(e) => setBars(bars.map((x, j) => (j === i ? { ...x, lengthMm: e.target.value } : x)))} /></label>
                <label className="text-xs">Çubuk adedi<input aria-label={`Adet ${i + 1}`} className="rf-input mt-1 w-28" inputMode="numeric" value={b.count} onChange={(e) => setBars(bars.map((x, j) => (j === i ? { ...x, count: e.target.value } : x)))} /></label>
                {bars.length > 1 && <button type="button" className="rf-secondary-button" onClick={() => setBars(bars.filter((_, j) => j !== i))}>Kaldır</button>}
              </div>
            ))}
            <button type="button" className="rf-secondary-button" onClick={() => setBars([...bars, { lengthMm: '', count: '' }])}>Başka boy ekle</button>
          </fieldset>

          <p className="text-sm" aria-live="polite">
            Girilen: <strong>{barCount} çubuk · {metres(entered)}</strong>
            {line && <> · listede {metres(Number(line.quantity))} · fark {entered - Number(line.quantity) >= 0 ? '+' : ''}{metres(entered - Number(line.quantity))}</>}
          </p>
          <button className="rf-primary-button" disabled={busy || (!line && (!itemId || !warehouseId))}>{busy ? 'Kaydediliyor…' : 'Çubukları stoğa yaz'}</button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Açılış sayımını firma yöneticisi girer.</p>
      )}
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {done && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{done}</p>}

      <section className="space-y-2">
        <h2 className="font-semibold">Son sayılan liste satırları</h2>
        <p className="text-sm text-muted-foreground">Çubukları bekleyen {data.lines.length} liste satırı var.</p>
        {data.counted.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr>{['Malzeme', 'Renk', 'Listede', 'Sayılan', 'Fark'].map((h) => <th key={h} className="p-2 text-xs text-muted-foreground">{h}</th>)}</tr></thead>
              <tbody>
                {data.counted.map((c) => {
                  const diff = Number(c.counted_meters) - Number(c.quantity);
                  return (
                    <tr key={c.id} className="border-t border-border">
                      <td className="p-2">{c.name}</td>
                      <td className="p-2">{c.color ? <ColorChip color={c.color} size={16} /> : '—'}</td>
                      <td className="p-2">{metres(Number(c.quantity))}</td>
                      <td className="p-2">{c.counted_bars} çubuk · {metres(Number(c.counted_meters))}</td>
                      <td className={`p-2 ${Math.abs(diff) > 0.0005 ? 'text-amber-700 dark:text-amber-300' : ''}`}>{diff >= 0 ? '+' : ''}{metres(diff)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
