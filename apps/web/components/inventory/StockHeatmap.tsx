'use client';

import { useEffect, useMemo, useState } from 'react';
import { Grid3x3 } from 'lucide-react';
import { ColorChip } from '@/components/colors/ColorSwatch';
import { colorKey } from '@/lib/features/colors/color-spec';
import { EmptyState, HintTip, Skeleton } from '@/components/kit';

type Cell = { itemId: string; color: string; lengthMm: number; bars: number };

/** Colour × length grid of whole bars on the shelf; darker cell, more bars. Per profile or all. */
export function StockHeatmap() {
  const [data, setData] = useState<{ items: Array<{ id: string; name: string }>; cells: Cell[] } | null>(null);
  const [item, setItem] = useState('');
  useEffect(() => {
    void fetch('/api/v1/inventory/heatmap', { cache: 'no-store' }).then(async (r) => setData(r.ok ? await r.json() : { items: [], cells: [] })).catch(() => setData({ items: [], cells: [] }));
  }, []);
  const view = useMemo(() => {
    const cells = (data?.cells ?? []).filter((c) => !item || c.itemId === item);
    const lengths = [...new Set(cells.map((c) => c.lengthMm))].sort((a, b) => b - a).slice(0, 10);
    const colors: string[] = [];
    for (const c of cells) if (!colors.some((x) => colorKey(x) === colorKey(c.color))) colors.push(c.color);
    const count = (color: string, len: number) => cells.filter((c) => colorKey(c.color) === colorKey(color) && c.lengthMm === len).reduce((n, c) => n + c.bars, 0);
    const max = Math.max(1, ...colors.flatMap((col) => lengths.map((l) => count(col, l))));
    return { lengths, colors: colors.slice(0, 14), count, max };
  }, [data, item]);
  return (
    <section className="rf-panel space-y-3 p-4" aria-label="Renk ve boy ısı haritası">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="rf-section-title flex items-center gap-2"><Grid3x3 size={16} aria-hidden /> Çubuk haritası <HintTip text="Satır renk, sütun çubuk boyu (mm). Hücredeki sayı o renk ve boyda raftaki çubuk adedi; koyu hücre daha çok çubuk." /></h2>
        {data && data.items.length > 1 && (
          <select aria-label="Profil" className="rf-input h-9 py-0 text-xs" value={item} onChange={(e) => setItem(e.target.value)}>
            <option value="">Tüm profiller</option>
            {data.items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        )}
      </div>
      {!data ? <Skeleton className="h-40 w-full" /> : !view.colors.length ? <EmptyState title="Çubuk yok" /> : (
        <div tabIndex={0} role="region" aria-label="Çubuk ısı haritası" className="overflow-x-auto">
          <table className="border-separate border-spacing-1 text-xs">
            <thead>
              <tr><th className="sr-only">Renk</th>{view.lengths.map((l) => <th key={l} className="px-1 text-right font-medium tabular-nums text-muted-foreground">{l.toLocaleString('tr-TR')}</th>)}</tr>
            </thead>
            <tbody>
              {view.colors.map((col) => (
                <tr key={col}>
                  <th scope="row" className="pr-2 text-left font-normal"><ColorChip color={col === 'Renk yok' ? null : col} size={16} className="max-w-[160px]" /></th>
                  {view.lengths.map((l) => {
                    const n = view.count(col, l);
                    const a = n / view.max;
                    return (
                      <td key={l} title={`${col} · ${l} mm · ${n} çubuk`} className="h-9 min-w-[52px] rounded text-center font-semibold tabular-nums"
                        style={{ background: n ? `hsl(var(--primary) / ${(0.12 + a * 0.75).toFixed(2)})` : 'hsl(var(--muted))', color: a > 0.5 ? '#fff' : undefined }}>
                        {n || ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
