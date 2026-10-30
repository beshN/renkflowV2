'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { ProductDrawing } from '@/components/drawing/ProductDrawing';
import { colorInfo } from '@/lib/features/colors/color-spec';
import { optimizeCuts, type CutDemand, type CutSource } from '@/lib/features/manufacturing/cutting-engine';
import { cn } from '@/lib/utils';
import { barsByItem, fmt, hours, LIMITS, planOrder, tl, type Spec } from './model';
import { BarRow } from './CutBars';
import { Flash, T, Tabs, Ticker } from './primitives';

const COLORS = ['RAL 7016 Mat', 'RAL 9016 Mat', 'RAL 9006', 'RAL 8019 Mat', 'RAL 7037 Mat', 'RAL 9005 Mat'];
const START: Spec = { widthMm: 5400, projectionMm: 4200, heightMm: 2600, color: 'RAL 7016 Mat', motor: true, led: true };

/**
 * The configurator: measures in, everything that depends on them out. The drawing is the workspace's
 * ProductDrawing; the cut list, plan, price and hours come from the recipe, cutting and quote engines.
 */
export function Configurator() {
  const [spec, setSpec] = useState<Spec>(START);
  const deferred = useDeferredValue(spec);
  const plan = useMemo(() => planOrder(deferred), [deferred]);
  const set = (patch: Partial<Spec>) => setSpec((s) => ({ ...s, ...patch }));
  const groups = barsByItem(plan.bars);

  return (
    <div className="grid gap-px overflow-hidden rounded-[var(--x-r-window)] bg-[var(--x-line)] shadow-[0_0_0_1px_var(--x-line),0_32px_64px_-48px_rgb(20_26_28/0.35)] lg:grid-cols-[1.25fr_1fr]">
      {/* Drawing sheet */}
      <div className="flex flex-col bg-[var(--x-surface)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--x-line)] px-5 py-3 text-[12px]">
          <span className="font-medium">Bioklimatik pergola</span>
          <span className="text-[var(--x-muted)]">Ön ve üst görünüş · tek ölçek</span>
        </div>
        <div className="relative flex-1 px-4 py-6 sm:px-8">
          <ProductDrawing family="pergola" widthMm={deferred.widthMm} projectionMm={deferred.projectionMm} heightMm={deferred.heightMm} color={deferred.color} className="x-drawing mx-auto h-auto w-full max-w-[620px]" />
        </div>
        <div className="grid gap-x-8 gap-y-5 border-t border-[var(--x-line)] px-5 py-5 sm:grid-cols-3">
          <Measure id="rfx-width" label="En" value={spec.widthMm} range={LIMITS.width} onChange={(v) => set({ widthMm: v })} />
          <Measure id="rfx-projection" label="Açılım" value={spec.projectionMm} range={LIMITS.projection} onChange={(v) => set({ projectionMm: v })} />
          <Measure id="rfx-height" label="Yükseklik" value={spec.heightMm} range={LIMITS.height} onChange={(v) => set({ heightMm: v })} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-t border-[var(--x-line)] px-5 py-4">
          <fieldset className="flex items-center gap-3">
            <legend className="sr-only">Renk</legend>
            <span className="text-[12px] text-[var(--x-muted)]" aria-hidden>Renk</span>
            <div className="flex gap-1.5">
              {COLORS.map((c) => {
                const info = colorInfo(c)!;
                const on = c === spec.color;
                return (
                  <label key={c} className="relative cursor-pointer" title={`${info.code} ${info.name}`}>
                    <input type="radio" name="rfx-color" value={c} checked={on} onChange={() => set({ color: c })} className="peer sr-only" />
                    <span className="block h-6 w-6 rounded-[5px] shadow-[inset_0_0_0_1px_var(--x-swatch-ring)] transition-transform duration-[120ms] hover:scale-105 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--x-bronze-fill)]" style={{ background: info.hex ?? undefined }} />
                    {on && <motion.span layoutId="rfx-color-ring" transition={T.indicator} className="absolute -inset-[3px] rounded-[7px] shadow-[0_0_0_1.5px_var(--x-ink)]" />}
                    <span className="sr-only">{info.code} {info.name}</span>
                  </label>
                );
              })}
            </div>
            <span className="text-[12px] text-[var(--x-ink-2)]">{colorInfo(spec.color)?.name}</span>
          </fieldset>
          <div className="flex gap-5">
            <Switch label="Motorlu lamel" checked={spec.motor} onChange={(v) => set({ motor: v })} />
            <Switch label="LED" checked={spec.led} onChange={(v) => set({ led: v })} />
          </div>
        </div>
      </div>

      {/* What follows from the measures */}
      <div className="flex flex-col bg-[var(--x-surface)]" aria-live="polite">
        <div className="border-b border-[var(--x-line)] px-5 py-3 text-[12px] font-medium">Bu ölçüden çıkanlar</div>
        <dl className="grid grid-cols-2 border-b border-[var(--x-line)]">
          <div className="border-r border-[var(--x-line)] px-5 py-4">
            <dt className="text-[12px] text-[var(--x-muted)]">Teklif, KDV dahil</dt>
            <dd className="x-display mt-1 text-[26px] leading-none"><Ticker value={plan.totals.totalAmount} format={tl} /></dd>
          </div>
          <div className="px-5 py-4">
            <dt className="text-[12px] text-[var(--x-muted)]">Atölye süresi</dt>
            <dd className="x-display mt-1 text-[26px] leading-none"><Ticker value={plan.minutes} format={hours} /></dd>
          </div>
        </dl>
        <div className="px-5 pt-4">
          <p className="text-[12px] font-medium">Kesim listesi</p>
          <table className="mt-2 w-full text-[12.5px]">
            <thead className="text-[11px] text-[var(--x-muted)]"><tr className="[&>th]:pb-1.5 [&>th]:text-left [&>th]:font-normal"><th>Profil</th><th className="!text-right">Boy</th><th className="!text-right">Adet</th></tr></thead>
            <tbody>
              {plan.cuts.map((c) => (
                <tr key={c.itemId} className="border-t border-[var(--x-line)] [&>td]:py-2">
                  <td className="pr-3"><span className="x-mono text-[var(--x-bronze)]">{c.item.code}</span> <span className="text-[var(--x-ink-2)]">{c.item.name}</span></td>
                  <td className="text-right"><Flash watch={c.lengthMm} className="x-num px-1">{fmt(c.lengthMm)}</Flash></td>
                  <td className="text-right"><Flash watch={c.quantity} className="x-num px-1">{c.quantity}</Flash></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-auto border-t border-[var(--x-line)] px-5 py-4">
          <p className="flex justify-between text-[12px]"><span className="font-medium">Profil ihtiyacı</span><span className="text-[var(--x-muted)]">artıklar önce kullanılır</span></p>
          <ul className="mt-2 space-y-1.5 text-[12.5px]">
            {groups.map(({ item, bars }) => {
              const remnant = bars.filter((b) => b.source.isRemnant).length;
              return (
                <li key={item.id} className="flex justify-between gap-3">
                  <span className="text-[var(--x-ink-2)]">{item.code} · {fmt(item.stockMm)} mm</span>
                  <span className="x-num"><Flash watch={bars.length} className="px-1">{bars.length - remnant} çubuk{remnant ? ` + ${remnant} artık` : ''}</Flash></span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Cut plan, from these measures or from the visitor's own list */}
      <div className="bg-[var(--x-surface)] lg:col-span-2">
        <CutPlan fromSpec={plan} />
      </div>
    </div>
  );
}

function Measure({ id, label, value, range, onChange }: { id: string; label: string; value: number; range: readonly [number, number]; onChange: (v: number) => void }) {
  const [text, setText] = useState<string | null>(null);
  const fill = ((value - range[0]) / (range[1] - range[0])) * 100;
  const commit = () => {
    if (text === null) return;
    const n = Math.round(Number(text.replace(/\./g, '').replace(',', '.')) / 10) * 10;
    if (Number.isFinite(n)) onChange(Math.min(range[1], Math.max(range[0], n)));
    setText(null);
  };
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[12px] text-[var(--x-muted)]">{label}</label>
        <span className="flex items-baseline gap-1">
          <input
            aria-label={`${label} (mm)`}
            inputMode="numeric"
            value={text ?? fmt(value)}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="x-num w-[64px] rounded-[4px] bg-transparent text-right text-[14px] font-semibold outline-none transition-shadow focus:shadow-[0_0_0_1px_var(--x-line-strong)]"
          />
          <span className="text-[11px] text-[var(--x-faint)]">mm</span>
        </span>
      </div>
      <input id={id} type="range" min={range[0]} max={range[1]} step={50} value={value} onChange={(e) => onChange(Number(e.target.value))} className="x-range mt-1.5" style={{ ['--fill' as string]: `${fill}%` }} aria-valuetext={`${fmt(value)} milimetre`} />
      <div className="x-num flex justify-between text-[10.5px] text-[var(--x-faint)]"><span>{fmt(range[0])}</span><span>{fmt(range[1])}</span></div>
    </div>
  );
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center gap-2 text-[12.5px] text-[var(--x-ink-2)]">
      <span className={cn('relative h-[18px] w-8 rounded-full transition-colors duration-200', checked ? 'bg-[var(--x-ink-2)]' : 'bg-[var(--x-line-strong)]')}>
        <motion.span className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.25)]" initial={false} animate={{ left: checked ? 16 : 2 }} transition={T.indicator} />
      </span>
      {label}
    </button>
  );
}

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

function CutPlan({ fromSpec }: { fromSpec: ReturnType<typeof planOrder> }) {
  const [mode, setMode] = useState<'spec' | 'own'>('spec');
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
  const specGroups = barsByItem(fromSpec.bars);
  const ownBars = own.plan ? own.plan.bars.filter((b) => b.pieces.length) : [];
  const field = 'x-num h-8 w-full rounded-[var(--x-r-control)] bg-[var(--x-surface)] px-2.5 text-[13px] shadow-[inset_0_0_0_1px_var(--x-line)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_var(--x-ink-2)]';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--x-line)] px-5 pt-3">
        <Tabs id="cutplan" label="Kesim planı kaynağı" value={mode} onChange={setMode} items={[{ key: 'spec', label: 'Bu ölçüden kesim planı' }, { key: 'own', label: 'Kendi kesim listeniz' }]} />
        <p className="pb-2.5 text-[12px] text-[var(--x-muted)]">Atölyedeki kesim motoruyla hesaplanır</p>
      </div>
      <div id="cutplan-panel" role="tabpanel" aria-labelledby={`cutplan-tab-${mode}`} className="px-5 py-5">
        <AnimatePresence mode="wait" initial={false}>
          {mode === 'spec' ? (
            <motion.div key="spec" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={T.base} className="grid gap-x-10 gap-y-6 md:grid-cols-2">
              {specGroups.map(({ item, bars }) => (
                <div key={item.id}>
                  <p className="mb-2 flex justify-between text-[12px]"><span className="font-medium">{item.code} · {item.name}</span><span className="x-num text-[var(--x-muted)]">{bars.length} çubuk</span></p>
                  <div className="space-y-1.5">{bars.slice(0, 4).map((bar, i) => <BarRow key={bar.source.id} bar={bar} scale={7000} index={i + 1} />)}</div>
                  {bars.length > 4 && <p className="mt-1.5 pl-[30px] text-[11px] text-[var(--x-faint)]">+{bars.length - 4} çubuk aynı düzende</p>}
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div key="own" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={T.base} className="grid gap-8 md:grid-cols-[280px_1fr]">
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
                      <span><b className="x-num mr-1 text-[18px] font-semibold text-[var(--x-ink)]">{ownBars.filter((b) => !b.source.isRemnant).length}</b>tam çubuk</span>
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
