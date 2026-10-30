'use client';

import { useMemo, useState } from 'react';
import { Plus, Recycle, X } from 'lucide-react';
import { optimizeCuts, type CutDemand, type CutSource } from '@/lib/features/manufacturing/cutting-engine';

type Row = { id: number; length: string; qty: string };

const ITEM = 'demo-profile';
const COLOR = 'RAL 9016';
const PARAMETERS = { kerfMm: 3, trimStartMm: 10, trimEndMm: 10, minimumRemnantMm: 500, standardLengthMm: 6000 };
const STANDARD = PARAMETERS.standardLengthMm;
const REMNANTS = [1450, 2100];
const MAX_ROWS = 6;
const START: Row[] = [
  { id: 1, length: '2350', qty: '3' },
  { id: 2, length: '1800', qty: '3' },
  { id: 3, length: '1200', qty: '2' },
];

const cm = (mm: number) => (mm / 10).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
const whole = (value: string, min: number, max: number) => {
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null;
};

/**
 * A small, live cutting plan on the landing page. It runs the same engine the workshop uses, so
 * the numbers a visitor sees (bars, remnants, scrap) are the ones the product would produce for
 * the same pieces. Nothing is sent anywhere.
 */
export function CutDemo() {
  const [rows, setRows] = useState<Row[]>(START);
  const [withRemnants, setWithRemnants] = useState(true);

  const result = useMemo(() => {
    const demand: CutDemand[] = [];
    let invalid = 0;
    for (const r of rows) {
      if (!r.length && !r.qty) continue;
      const lengthMm = whole(r.length, 50, STANDARD);
      const quantity = whole(r.qty, 1, 99);
      if (lengthMm === null || quantity === null) { invalid++; continue; }
      demand.push({ itemId: ITEM, color: COLOR, lengthMm, quantity, workOrderId: 'demo' });
    }
    // Plenty of whole bars, so the plan shows what it would take rather than what the demo owns.
    const sources: CutSource[] = [
      ...(withRemnants ? REMNANTS.map((lengthMm, i) => ({ id: `r${i}`, itemId: ITEM, color: COLOR, lengthMm, unitCost: 0, isRemnant: true })) : []),
      ...Array.from({ length: 40 }, (_, i) => ({ id: `b${i}`, itemId: ITEM, color: COLOR, lengthMm: STANDARD, unitCost: 1, isRemnant: false })),
    ];
    const plan = demand.length ? optimizeCuts(demand, sources, PARAMETERS, { objective: 'material' }) : null;
    return { plan, invalid, pieces: demand.reduce((n, d) => n + d.quantity, 0) };
  }, [rows, withRemnants]);

  const update = (id: number, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const add = () => setRows((list) => (list.length >= MAX_ROWS ? list : [...list, { id: Math.max(0, ...list.map((r) => r.id)) + 1, length: '', qty: '' }]));
  const remove = (id: number) => setRows((list) => list.filter((r) => r.id !== id));

  const plan = result.plan;
  const bars = plan ? plan.bars.filter((b) => b.pieces.length) : [];
  const usedRemnants = bars.filter((b) => b.source.isRemnant).length;
  const wholeBars = bars.length - usedRemnants;
  const field = 'h-9 w-full rounded-md border border-border bg-background px-2.5 text-[14px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

  return (
    <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-[13px] font-medium">Kesilecek parçalar</p>
        <div className="mt-3 grid grid-cols-[1fr_5.5rem_2rem] gap-x-2 gap-y-2 text-[12px] text-muted-foreground">
          <span>Boy (mm)</span><span>Adet</span><span />
          {rows.map((r, i) => (
            <div key={r.id} className="contents">
              <input aria-label={`${i + 1}. parça boyu (mm)`} inputMode="numeric" value={r.length} onChange={(e) => update(r.id, { length: e.target.value })} className={field} />
              <input aria-label={`${i + 1}. parça adedi`} inputMode="numeric" value={r.qty} onChange={(e) => update(r.id, { qty: e.target.value })} className={field} />
              <button type="button" onClick={() => remove(r.id)} aria-label={`${i + 1}. satırı sil`} className="grid h-9 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><X size={14} aria-hidden /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={add} disabled={rows.length >= MAX_ROWS} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground hover:underline disabled:opacity-40"><Plus size={14} aria-hidden /> Parça ekle</button>
        <label className="mt-5 flex cursor-pointer items-start gap-2.5 border-t border-border pt-4 text-[13px]">
          <input type="checkbox" checked={withRemnants} onChange={(e) => setWithRemnants(e.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" />
          <span>Depoda artık var <span className="block text-muted-foreground">{REMNANTS.map((n) => `${cm(n)} cm`).join(' ve ')} boyunda iki artık</span></span>
        </label>
        <p className="mt-4 text-[12px] leading-5 text-muted-foreground">Standart boy {cm(STANDARD)} cm · testere payı {PARAMETERS.kerfMm} mm · uç payı {PARAMETERS.trimStartMm} mm. {cm(PARAMETERS.minimumRemnantMm)} cm ve üstü artık olarak saklanır.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5" aria-live="polite">
        {plan && bars.length ? (
          <>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
              <span><b className="text-[20px] font-semibold tabular-nums tracking-tight">{result.pieces}</b> <span className="text-muted-foreground">parça</span></span>
              <span><b className="text-[20px] font-semibold tabular-nums tracking-tight">{wholeBars}</b> <span className="text-muted-foreground">tam profil</span></span>
              {usedRemnants > 0 && <span><b className="text-[20px] font-semibold tabular-nums tracking-tight">{usedRemnants}</b> <span className="text-muted-foreground">artık kullanıldı</span></span>}
              <span><b className="text-[20px] font-semibold tabular-nums tracking-tight">%{plan.wastePercent.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}</b> <span className="text-muted-foreground">fire</span></span>
            </div>
            <ul className="mt-4 space-y-2">
              {bars.map((b, i) => (
                <li key={b.source.id}>
                  <div className="flex items-baseline justify-between text-[12px] text-muted-foreground">
                    <span>{i + 1}. {b.source.isRemnant ? 'artık' : 'profil'} · {cm(b.source.lengthMm)} cm</span>
                    <span className={b.reusable ? 'text-emerald-700 dark:text-emerald-400' : ''}>{b.remainingMm < 1 ? 'kalan yok' : b.reusable ? `${cm(b.remainingMm)} cm artık olarak kalır` : `${cm(b.remainingMm)} cm fire`}</span>
                  </div>
                  <div className="mt-1 flex h-8 overflow-hidden rounded-md bg-muted" style={{ width: `${(b.source.lengthMm / STANDARD) * 100}%` }} role="img" aria-label={`${b.pieces.map((p) => `${cm(p.lengthMm)} cm`).join(', ')} kesilir`}>
                    {b.pieces.map((p, j) => (
                      <span key={j} style={{ width: `${(p.lengthMm / b.source.lengthMm) * 100}%` }} className={`grid place-items-center border-r border-background text-[11px] font-medium tabular-nums ${b.source.isRemnant ? 'bg-emerald-700 text-white' : 'bg-foreground text-background'}`}>{p.lengthMm >= 700 ? cm(p.lengthMm) : ''}</span>
                    ))}
                    {b.reusable && <span className="flex flex-1 items-center justify-center bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"><Recycle size={13} aria-hidden /></span>}
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-[14px] text-muted-foreground">Soldaki listeye en az bir parça yazın; plan burada oluşur.</p>
        )}
        {plan && plan.unfulfilled.length > 0 && <p role="alert" className="mt-3 text-[13px] text-rose-700 dark:text-rose-400">{plan.unfulfilled.length} parça yerleştirilemedi.</p>}
        {result.invalid > 0 && <p className="mt-3 text-[12px] text-muted-foreground">{result.invalid} satır geçersiz olduğu için atlandı. Boy 50 ile {STANDARD} mm, adet 1 ile 99 arasında olmalı.</p>}
      </div>
    </div>
  );
}
