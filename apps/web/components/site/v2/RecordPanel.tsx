'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Clock3, PackageCheck, Truck, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { barsByItem, fmt, hours, ITEMS, mm, planOrder, STAGES, stageIndex, STOCK, tl, type Order, type Plan } from './model';
import { StageStrip, Swatch, T, Tabs } from './primitives';
import { BarRow } from './CutBars';

type TabKey = 'quote' | 'production' | 'cutting' | 'stock' | 'shipping';
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'quote', label: 'Teklif' },
  { key: 'production', label: 'Üretim' },
  { key: 'cutting', label: 'Kesim' },
  { key: 'stock', label: 'Stok' },
  { key: 'shipping', label: 'Sevkiyat' },
];
// The tab an order opens on: the part of the record its current step is about.
const TAB_FOR_STAGE: Record<Order['stage'], TabKey> = { quote: 'quote', approval: 'quote', production: 'production', cutting: 'cutting', assembly: 'shipping', delivery: 'shipping' };

/**
 * One order, as the record drawer in the workspace shows it: header, step strip, and the tabs that
 * follow the order from quote to delivery. Escape closes it; the step only moves one step at a time.
 */
export function RecordPanel({ order, onClose, onAdvance }: { order: Order; onClose: () => void; onAdvance: (id: string) => void }) {
  const plan = useMemo(() => planOrder(order.spec, order.id), [order.spec, order.id]);
  const [tab, setTab] = useState<TabKey>(TAB_FOR_STAGE[order.stage]);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { setTab(TAB_FOR_STAGE[order.stage]); }, [order.id]);
  useEffect(() => { closeRef.current?.focus({ preventScroll: true }); }, [order.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const at = stageIndex(order.stage);
  const next = STAGES[at + 1];
  const { widthMm, projectionMm, heightMm, color } = order.spec;

  return (
    <motion.aside
      role="dialog"
      aria-label={`${order.id} ${order.customer}`}
      initial={{ x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 24, opacity: 0 }}
      transition={T.slow}
      className="absolute inset-y-0 right-0 z-20 flex w-full flex-col border-l border-[var(--x-line)] bg-[var(--x-surface)] shadow-[-24px_0_48px_-32px_rgb(20_26_28/0.35)] sm:w-[min(500px,100%)]"
    >
      <div className="border-b border-[var(--x-line)] px-5 pb-4 pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[12px] text-[var(--x-muted)]"><span className="x-mono text-[var(--x-bronze)]">{order.id}</span><span>{order.owner}</span></p>
            <h3 className="mt-1 truncate text-[17px] font-semibold tracking-[-0.015em]">{order.customer} <span className="font-normal text-[var(--x-muted)]">{order.city}</span></h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--x-ink-2)]">
              <span>{order.product}</span>
              <span className="x-num">{fmt(widthMm)} × {fmt(projectionMm)} × {fmt(heightMm)}</span>
              <Swatch color={color} />
            </p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Kaydı kapat" className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--x-r-control)] text-[var(--x-muted)] transition-colors hover:bg-[var(--x-surface-hover)] hover:text-[var(--x-ink)]"><X size={15} /></button>
        </div>
        <StageStrip stage={order.stage} className="mt-4" />
        <div className="mt-3 flex items-center justify-between gap-3 text-[12px]">
          <span className="flex items-center gap-1.5 text-[var(--x-muted)]"><Clock3 size={13} aria-hidden /> Termin {order.due}</span>
          {next ? (
            <button type="button" onClick={() => onAdvance(order.id)} className="x-ctl">Sonraki aşama: {next.label}</button>
          ) : (
            <span className="flex items-center gap-1.5 font-medium text-[var(--x-ok)]"><Check size={13} aria-hidden /> Teslim edildi</span>
          )}
        </div>
      </div>

      <div className="px-5 pt-3">
        <Tabs id={`rec-${order.id}`} label="Kayıt bölümleri" items={TABS} value={tab} onChange={setTab} />
      </div>

      <div id={`rec-${order.id}-panel`} role="tabpanel" aria-labelledby={`rec-${order.id}-tab-${tab}`} className="relative min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4 [scrollbar-width:thin]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -2 }} transition={T.base}>
            {tab === 'quote' && <QuoteTab order={order} plan={plan} onAdvance={onAdvance} />}
            {tab === 'production' && <ProductionTab order={order} plan={plan} />}
            {tab === 'cutting' && <CuttingTab plan={plan} />}
            {tab === 'stock' && <StockTab order={order} plan={plan} />}
            {tab === 'shipping' && <ShippingTab order={order} plan={plan} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={cn('flex justify-between gap-4 py-1.5 text-[12.5px]', strong && 'border-t border-[var(--x-line)] pt-2.5 text-[14px] font-semibold')}><span className={strong ? '' : 'text-[var(--x-muted)]'}>{label}</span><span className="x-num">{value}</span></div>;
}

function QuoteTab({ order, plan, onAdvance }: { order: Order; plan: Plan; onAdvance: (id: string) => void }) {
  const draft = order.stage === 'quote';
  const waiting = order.stage === 'approval';
  return (
    <div>
      <div className="overflow-hidden rounded-[var(--x-r-panel)] shadow-[var(--x-shadow-raise)]">
        <div className="grid grid-cols-[1fr_auto] gap-3 bg-[var(--x-surface-sunk)] px-3 py-2 text-[11px] text-[var(--x-muted)]"><span>Kalem</span><span>Tutar</span></div>
        {plan.lines.map((line) => (
          <div key={line.label} className="grid grid-cols-[1fr_auto] gap-3 border-t border-[var(--x-line)] px-3 py-2.5 text-[12.5px]">
            <span className="min-w-0 truncate">{line.label}</span>
            <span className="x-num">{tl(line.unitPrice * line.quantity)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 px-1">
        <Row label="Ara toplam" value={tl(plan.totals.subtotal)} />
        <Row label="KDV %20" value={tl(plan.totals.taxAmount)} />
        <Row label="Genel toplam" value={tl(plan.totals.totalAmount)} strong />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-[var(--x-r-panel)] bg-[var(--x-surface-sunk)] px-3 py-2.5 text-[12px]">
        <span className="text-[var(--x-ink-2)]">{draft ? 'Taslak. Müşteriye henüz gönderilmedi.' : waiting ? 'Gönderildi. Müşteri onayı bekleniyor.' : 'Müşteri teklifi bağlantıdan onayladı.'}</span>
        {draft && <button type="button" className="x-ctl x-ctl-ink" onClick={() => onAdvance(order.id)}>Teklifi gönder</button>}
        {waiting && <button type="button" className="x-ctl" onClick={() => onAdvance(order.id)}>Onayı işle</button>}
        {!draft && !waiting && <Check size={14} className="text-[var(--x-ok)]" aria-label="Onaylandı" />}
      </div>
      <p className="mt-3 text-[11.5px] leading-5 text-[var(--x-faint)]">Fiyat, ölçü ve seçeneklerden hesaplanır; ölçü değişirse teklif ve kesim listesi birlikte yenilenir.</p>
    </div>
  );
}

function ProductionTab({ order, plan }: { order: Order; plan: Plan }) {
  const at = stageIndex(order.stage);
  // Which operation the order is at, from its step: cutting runs the first, assembly the last.
  const active = at < 2 ? -1 : at === 2 ? 0 : at === 3 ? 0 : at === 4 ? 3 : 4;
  const done = (i: number) => at >= 5 || (at === 4 && i < 3);
  return (
    <div>
      <ol className="relative">
        {plan.recipe.operations.map((op, i) => {
          const isDone = done(i), isActive = i === active && !isDone;
          return (
            <li key={op.name} className="grid grid-cols-[20px_1fr_auto] items-start gap-3 py-2.5">
              <span className={cn('mt-0.5 grid h-4 w-4 place-items-center rounded-full', isDone ? 'bg-[var(--x-ink-2)] text-[var(--x-surface)]' : isActive ? 'shadow-[inset_0_0_0_1.5px_var(--x-bronze-fill)]' : 'shadow-[inset_0_0_0_1px_var(--x-line-strong)]')}>
                {isDone && <Check size={10} strokeWidth={3} aria-hidden />}
                {isActive && <span className="h-1.5 w-1.5 rounded-full bg-[var(--x-bronze-fill)]" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">{op.name}</span>
                <span className="block text-[11.5px] text-[var(--x-muted)]">{op.workCenterCode} · {isDone ? 'Tamamlandı' : isActive ? (at === 2 ? 'Malzeme hazırlanıyor' : 'Devam ediyor') : 'Sırada'}</span>
              </span>
              <span className="x-num text-[12px] text-[var(--x-ink-2)]">{Math.round(op.plannedMinutes)} dk</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-2 border-t border-[var(--x-line)] px-0.5 pt-3">
        <Row label="Planlanan toplam süre" value={hours(plan.minutes)} />
        <Row label="Reçete" value={`${plan.recipe.recipeCode} · v${plan.recipe.recipeVersion}`} />
      </div>
    </div>
  );
}

function CuttingTab({ plan }: { plan: Plan }) {
  const groups = barsByItem(plan.bars);
  const remnants = plan.bars.filter((b) => b.source.isRemnant).length;
  return (
    <div>
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[var(--x-r-panel)] bg-[var(--x-line)] shadow-[0_0_0_1px_var(--x-line)]">
        {[[String(plan.bars.length), 'profil'], [String(remnants), 'artık kullanıldı'], [`%${fmt(plan.cut.wastePercent, 1)}`, 'fire']].map(([v, l]) => (
          <div key={l} className="bg-[var(--x-surface)] px-3 py-2.5"><p className="x-num text-[16px] font-semibold tracking-[-0.02em]">{v}</p><p className="text-[11px] text-[var(--x-muted)]">{l}</p></div>
        ))}
      </div>
      <div className="mt-4 space-y-4">
        {groups.map(({ item, bars }) => {
          const shown = bars.slice(0, 2);
          return (
            <div key={item.id}>
              <p className="flex justify-between gap-3 text-[12px]"><span className="font-medium">{item.code} · {item.name}</span><span className="x-num text-[var(--x-muted)]">{bars.length} profil</span></p>
              <div className="mt-1.5 space-y-1.5">{shown.map((bar) => <BarRow key={bar.source.id} bar={bar} scale={7000} dense />)}</div>
              {bars.length > shown.length && <p className="mt-1 text-[11px] text-[var(--x-faint)]">+{bars.length - shown.length} profil aynı düzende</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StockTab({ order, plan }: { order: Order; plan: Plan }) {
  const [requested, setRequested] = useState(false);
  const groups = barsByItem(plan.bars);
  const rows = groups.map(({ item, bars }) => {
    const whole = bars.filter((b) => !b.source.isRemnant).length;
    const stock = STOCK.find((s) => ITEMS[s.item].id === item.id && s.color === order.spec.color);
    const free = stock ? stock.bars - stock.reserved : 0;
    return { item, whole, remnants: bars.length - whole, free, rack: stock?.rack, short: Math.max(0, whole - free) };
  });
  const shortage = rows.filter((r) => r.short > 0);
  const materials = plan.recipe.materials.filter((m) => m.itemId === ITEMS.motor.id || m.itemId === ITEMS.led.id);
  return (
    <div>
      <div className="overflow-hidden rounded-[var(--x-r-panel)] shadow-[var(--x-shadow-raise)]">
        <div className="grid grid-cols-[1fr_52px_52px_70px] gap-2 bg-[var(--x-surface-sunk)] px-3 py-2 text-[11px] text-[var(--x-muted)]"><span>Profil · <Swatch color={order.spec.color} className="align-middle" /></span><span className="text-right">Gerekli</span><span className="text-right">Serbest</span><span className="text-right">Durum</span></div>
        {rows.map((r) => (
          <div key={r.item.id} className="grid grid-cols-[1fr_52px_52px_70px] items-center gap-2 border-t border-[var(--x-line)] px-3 py-2.5 text-[12.5px]">
            <span className="min-w-0"><span className="block truncate">{r.item.code} · {r.item.name}</span><span className="block text-[11px] text-[var(--x-faint)]">{r.rack ? `Raf ${r.rack}` : 'Bu renkte stok yok'}{r.remnants ? ` · ${r.remnants} artık` : ''}</span></span>
            <span className="x-num text-right">{r.whole}</span>
            <span className="x-num text-right">{r.free}</span>
            <span className={cn('text-right text-[11.5px] font-medium', r.short ? 'text-[var(--x-danger)]' : 'text-[var(--x-ok)]')}>{r.short ? `${r.short} eksik` : 'Yeterli'}</span>
          </div>
        ))}
      </div>
      {materials.length > 0 && (
        <div className="mt-3 space-y-1 px-1">
          {materials.map((m) => <Row key={m.itemId} label={m.itemId === ITEMS.motor.id ? ITEMS.motor.name : ITEMS.led.name} value={m.uom === 'm' ? `${fmt(m.quantity, 1)} m` : `${m.quantity} adet`} />)}
        </div>
      )}
      {shortage.length > 0 ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-[var(--x-r-panel)] bg-[var(--x-surface-sunk)] px-3 py-2.5 text-[12px]">
          <span className="text-[var(--x-ink-2)]">{requested ? 'Satın alma talebi SA-0318 oluşturuldu.' : `${shortage.reduce((n, r) => n + r.short, 0)} profil satın alınmalı.`}</span>
          {!requested ? <button type="button" className="x-ctl x-ctl-ink" onClick={() => setRequested(true)}>Talep oluştur</button> : <Check size={14} className="text-[var(--x-ok)]" aria-hidden />}
        </div>
      ) : (
        <p className="mt-4 text-[12px] text-[var(--x-muted)]">Bütün profiller rafta; kesim için rezerve edildi.</p>
      )}
    </div>
  );
}

function ShippingTab({ order, plan }: { order: Order; plan: Plan }) {
  const packages = useMemo(() => {
    const count = (code: string) => plan.cuts.filter((c) => c.item.code === code).reduce((n, c) => n + c.quantity, 0);
    return [
      { id: 'beam', label: 'Kiriş paketi', detail: `${count('6017') + count('6018')} parça · en uzun ${mm(order.spec.widthMm)}` },
      { id: 'blade', label: 'Lamel paketi', detail: `${count('6056')} lamel` },
      { id: 'post', label: 'Dikmeler', detail: `${count('108')} adet · ${mm(order.spec.heightMm)}` },
      ...(order.spec.motor ? [{ id: 'motor', label: 'Motor ve kumanda', detail: 'Koli 1/1' }] : []),
      { id: 'kit', label: 'Bağlantı seti', detail: 'Vida, dübel, köşe takozu' },
    ];
  }, [plan, order.spec]);
  const ready = stageIndex(order.stage) >= 4;
  const [loaded, setLoaded] = useState<string[]>(order.stage === 'delivery' ? packages.map((p) => p.id) : []);
  const toggle = (id: string) => setLoaded((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  return (
    <div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--x-r-panel)] bg-[var(--x-line)] shadow-[0_0_0_1px_var(--x-line)] text-[12px]">
        <div className="bg-[var(--x-surface)] px-3 py-2.5"><p className="text-[11px] text-[var(--x-muted)]">Araç</p><p className="mt-0.5 flex items-center gap-1.5 font-medium"><Truck size={13} aria-hidden /> 35 RF 042</p></div>
        <div className="bg-[var(--x-surface)] px-3 py-2.5"><p className="text-[11px] text-[var(--x-muted)]">Montaj</p><p className="mt-0.5 font-medium">{order.due} · Ekip 2</p></div>
      </div>
      <p className="mb-1 mt-4 flex justify-between text-[12px]"><span className="font-medium">Yükleme listesi</span><span className="x-num text-[var(--x-muted)]">{loaded.length}/{packages.length}</span></p>
      <ul>
        {packages.map((p) => {
          const on = loaded.includes(p.id);
          return (
            <li key={p.id}>
              <button type="button" disabled={!ready} onClick={() => toggle(p.id)} aria-pressed={on} className="x-row flex w-full items-center gap-3 rounded-[var(--x-r-control)] px-2 py-2 text-left disabled:cursor-default">
                <span className={cn('grid h-4 w-4 shrink-0 place-items-center rounded-[4px] transition-colors duration-[120ms]', on ? 'bg-[var(--x-ink-2)] text-[var(--x-surface)]' : 'shadow-[inset_0_0_0_1px_var(--x-line-strong)]')}>
                  <AnimatePresence>{on && <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={T.fast}><Check size={10} strokeWidth={3} /></motion.span>}</AnimatePresence>
                </span>
                <span className="min-w-0 flex-1"><span className={cn('block text-[12.5px]', on && 'text-[var(--x-muted)] line-through decoration-[var(--x-line-strong)]')}>{p.label}</span><span className="block text-[11px] text-[var(--x-faint)]">{p.detail}</span></span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-[var(--x-muted)]"><PackageCheck size={13} aria-hidden />{ready ? (loaded.length === packages.length ? 'Hepsi yüklendi; müşteriye teslimat bağlantısı gönderilir.' : 'Paketleri yüklendikçe işaretleyin.') : 'Liste kesim bitince kesinleşir; işaretleme montaj aşamasında açılır.'}</p>
    </div>
  );
}
