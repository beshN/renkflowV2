'use client';

import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { optimizeCuts, type CutDemand, type CutSource } from '@/lib/features/manufacturing/cutting-engine';
import { fmt } from './model';
import { BarRow } from './CutBars';

/** The current landing's cutting demo, kept as is: the visitor's own pieces on the workshop's cutting engine. */
// "Your own list" uses the same parameters the current landing demo uses.
const ITEM = 'demo-profile';
const OWN_COLOR = 'RAL 9016';
const OWN_PARAMETERS = { kerfMm: 3, trimStartMm: 10, trimEndMm: 10, minimumRemnantMm: 500, standardLengthMm: 6000 };
const OWN_REMNANTS = [1450, 2100];
type Row = { id: number; length: string; qty: string };
const whole = (value: string, min: number, max: number) => {
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null;
};

export function OwnCutList() {
  const [rows, setRows] = useState<Row[]>([{ id: 1, length: '2350', qty: '3' }, { id: 2, length: '1800', qty: '3' }, { id: 3, length: '1200', qty: '2' }]);
  const [withRemnants, setWithRemnants] = useState(true);

  const own = useMemo(() => {
    const demand: CutDemand[] = [];
    let invalid = 0;
    for (const r of rows) {
      if (!r.length && !r.qty) continue;
      const lengthMm = whole(r.length, 50, 6000), quantity = whole(r.qty, 1, 99);
      if (lengthMm === null || quantity === null) { invalid++; continue; }
      demand.push({ itemId: ITEM, color: OWN_COLOR, lengthMm, quantity, workOrderId: 'demo' });
    }
    const sources: CutSource[] = [
      ...(withRemnants ? OWN_REMNANTS.map((lengthMm, i) => ({ id: `r${i}`, itemId: ITEM, color: OWN_COLOR, lengthMm, unitCost: 0, isRemnant: true })) : []),
      ...Array.from({ length: 40 }, (_, i) => ({ id: `b${i}`, itemId: ITEM, color: OWN_COLOR, lengthMm: 6000, unitCost: 1, isRemnant: false })),
    ];
    const plan = demand.length ? optimizeCuts(demand, sources, OWN_PARAMETERS, { objective: 'material' }) : null;
    return { plan, invalid, pieces: demand.reduce((n, d) => n + d.quantity, 0) };
  }, [rows, withRemnants]);

  const update = (id: number, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const ownBars = own.plan ? own.plan.bars.filter((b) => b.pieces.length) : [];
  const field = 'x-num h-8 w-full rounded-[var(--x-r-control)] bg-[var(--x-surface)] px-2.5 text-[13px] shadow-[inset_0_0_0_1px_var(--x-line)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_var(--x-ink-2)]';

  return (
            <div className="grid gap-8 md:grid-cols-[280px_1fr]">
              <div>
                <div className="grid grid-cols-[1fr_4.5rem_1.75rem] gap-x-2 gap-y-1.5 text-[11px] text-[var(--x-muted)]">
                  <span>Boy (mm)</span><span>Adet</span><span />
                  {rows.map((r, i) => (
                    <div key={r.id} className="contents">
                      <input aria-label={`${i + 1}. parça boyu (mm)`} inputMode="numeric" value={r.length} onChange={(e) => update(r.id, { length: e.target.value })} className={field} />
                      <input aria-label={`${i + 1}. parça adedi`} inputMode="numeric" value={r.qty} onChange={(e) => update(r.id, { qty: e.target.value })} className={field} />
                      <button type="button" onClick={() => setRows((l) => l.filter((x) => x.id !== r.id))} aria-label={`${i + 1}. satırı sil`} className="grid h-8 w-7 place-items-center rounded-[var(--x-r-control)] text-[var(--x-faint)] hover:bg-[var(--x-surface-hover)] hover:text-[var(--x-ink)]"><X size={13} /></button>
                    </div>
                  ))}
                </div>
                <button type="button" disabled={rows.length >= 6} onClick={() => setRows((l) => [...l, { id: Math.max(0, ...l.map((x) => x.id)) + 1, length: '', qty: '' }])} className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium hover:underline disabled:opacity-40"><Plus size={13} aria-hidden /> Parça ekle</button>
                <label className="mt-4 flex cursor-pointer items-start gap-2.5 border-t border-[var(--x-line)] pt-3.5 text-[12.5px]">
                  <input type="checkbox" checked={withRemnants} onChange={(e) => setWithRemnants(e.target.checked)} className="mt-0.5 size-3.5 accent-[var(--x-ink-2)]" />
                  <span>Depoda artık var<span className="block text-[11.5px] text-[var(--x-muted)]">145 cm ve 210 cm boyunda iki artık</span></span>
                </label>
                <p className="mt-3 text-[11px] leading-5 text-[var(--x-faint)]">Standart boy 600 cm, testere payı 3 mm, uç payı 10 mm. 50 cm ve üstü artık olarak rafa döner.</p>
              </div>
              <div aria-live="polite">
                {own.plan && ownBars.length ? (
                  <>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-[var(--x-muted)]">
                      <span><b className="x-num mr-1 text-[18px] font-semibold text-[var(--x-ink)]">{own.pieces}</b>parça</span>
                      <span><b className="x-num mr-1 text-[18px] font-semibold text-[var(--x-ink)]">{ownBars.filter((b) => !b.source.isRemnant).length}</b>tam profil</span>
                      <span><b className="x-num mr-1 text-[18px] font-semibold text-[var(--x-ink)]">{ownBars.filter((b) => b.source.isRemnant).length}</b>artık kullanıldı</span>
                      <span><b className="x-num mr-1 text-[18px] font-semibold text-[var(--x-ink)]">%{fmt(own.plan.wastePercent, 1)}</b>fire</span>
                    </div>
                    <div className="mt-4 space-y-1.5">{ownBars.map((bar, i) => <BarRow key={bar.source.id} bar={bar} scale={6000} index={i + 1} />)}</div>
                  </>
                ) : (
                  <p className="text-[13px] text-[var(--x-muted)]">Soldaki listeye en az bir parça yazın; plan burada oluşur.</p>
                )}
                {own.plan && own.plan.unfulfilled.length > 0 && <p role="alert" className="mt-3 text-[12.5px] text-[var(--x-danger)]">{own.plan.unfulfilled.length} parça yerleştirilemedi.</p>}
                {own.invalid > 0 && <p className="mt-3 text-[12px] text-[var(--x-muted)]">{own.invalid} satır atlandı. Boy 50 ile 6.000 mm, adet 1 ile 99 arasında olmalı.</p>}
              </div>
            </div>
  );
}
