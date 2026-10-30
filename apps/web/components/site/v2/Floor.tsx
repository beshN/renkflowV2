'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmt, ORDERS, planOrder } from './model';
import { StageLabel, Swatch, T } from './primitives';

const ORDER = ORDERS[0];

/**
 * Workshop and office on one record: the operator ticks cut pieces on the station tablet and the
 * office list moves with it. Same data model as the hero; the tablet layout follows the station screen.
 */
export function Floor() {
  const plan = useMemo(() => planOrder(ORDER.spec, ORDER.id), []);
  const pieces = plan.cuts.map((c) => ({ key: c.item.code, label: c.item.name, lengthMm: c.lengthMm, quantity: c.quantity }));
  const [done, setDone] = useState<string[]>([pieces[0].key]);
  const [finished, setFinished] = useState(false);
  const [log, setLog] = useState<Array<{ t: string; text: string }>>([{ t: '09:12', text: `${pieces[0].key} kesildi · ${pieces[0].quantity} parça` }]);
  const clock = (n: number) => `09:${String(12 + n * 7).padStart(2, '0')}`;

  const toggle = (key: string) => {
    if (finished) return;
    const on = done.includes(key);
    setDone((d) => (on ? d.filter((k) => k !== key) : [...d, key]));
    const p = pieces.find((x) => x.key === key)!;
    if (!on) setLog((l) => [{ t: clock(l.length), text: `${p.key} kesildi · ${p.quantity} parça` }, ...l].slice(0, 5));
  };
  const finish = () => {
    setFinished(true);
    setLog((l) => [{ t: clock(l.length), text: 'Kesim tamamlandı, montaja geçti' }, ...l].slice(0, 5));
  };
  const reset = () => { setDone([pieces[0].key]); setFinished(false); setLog([{ t: '09:12', text: `${pieces[0].key} kesildi · ${pieces[0].quantity} parça` }]); };
  const all = done.length === pieces.length;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
      {/* Station tablet */}
      <div className="rounded-[22px] bg-[var(--x-chrome)] p-2.5 shadow-[0_0_0_1px_rgb(0_0_0/0.25),0_40px_80px_-48px_rgb(10_14_16/0.7)]">
        <div className="overflow-hidden rounded-[14px] bg-[var(--x-surface)]">
          <div className="flex items-center justify-between bg-[var(--x-chrome-raised)] px-5 py-3 text-[var(--x-chrome-fg)]">
            <span className="text-[13px] font-medium">Kesim istasyonu 1</span>
            <span className="text-[12px] text-[var(--x-chrome-muted)]">Usta: Hakan T.</span>
          </div>
          <div className="px-5 pb-5 pt-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="x-mono text-[13px] text-[var(--x-bronze)]">{ORDER.id}</p>
                <p className="mt-0.5 text-[20px] font-semibold tracking-[-0.02em]">{ORDER.customer}</p>
                <p className="mt-1 flex items-center gap-3 text-[13px] text-[var(--x-ink-2)]"><Swatch color={ORDER.spec.color} /><span className="x-num">{fmt(ORDER.spec.widthMm)} × {fmt(ORDER.spec.projectionMm)}</span></p>
              </div>
              <p className="x-num text-right text-[13px] text-[var(--x-muted)]"><span className="block text-[22px] font-semibold text-[var(--x-ink)]">{done.length}/{pieces.length}</span>profil</p>
            </div>
            <ul className="mt-4 space-y-2">
              {pieces.map((p) => {
                const on = done.includes(p.key);
                return (
                  <li key={p.key}>
                    <button type="button" onClick={() => toggle(p.key)} aria-pressed={on} disabled={finished} className={cn('flex min-h-[56px] w-full items-center gap-4 rounded-[10px] px-4 text-left transition-[background-color,box-shadow] duration-200', on ? 'bg-[var(--x-surface-sunk)] shadow-[inset_0_0_0_1px_var(--x-line)]' : 'bg-[var(--x-surface)] shadow-[inset_0_0_0_1px_var(--x-line-strong)] hover:bg-[var(--x-surface-hover)]')}>
                      <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors duration-200', on ? 'bg-[var(--x-st-assembly)] text-white' : 'shadow-[inset_0_0_0_1.5px_var(--x-line-strong)]')}>
                        <AnimatePresence>{on && <motion.span initial={{ scale: 0.3 }} animate={{ scale: 1 }} exit={{ scale: 0.3, opacity: 0 }} transition={T.indicator}><Check size={15} strokeWidth={3} /></motion.span>}</AnimatePresence>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-[15px] font-medium', on && 'text-[var(--x-muted)]')}><span className="x-mono">{p.key}</span> {p.label}</span>
                      </span>
                      <span className="x-num text-right text-[15px] font-semibold">{fmt(p.lengthMm)}<span className="ml-1 text-[12px] font-normal text-[var(--x-muted)]">mm × {p.quantity}</span></span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex items-center gap-3">
              <button type="button" onClick={finish} disabled={!all || finished} className={cn('h-12 flex-1 rounded-[10px] text-[15px] font-semibold transition-colors duration-200', finished ? 'bg-[var(--x-st-assembly)] text-white' : all ? 'bg-[var(--x-ink)] text-[var(--x-surface)] hover:bg-[var(--x-ink-2)]' : 'bg-[var(--x-surface-sunk)] text-[var(--x-faint)]')}>
                {finished ? 'Kesim tamamlandı' : all ? 'Kesimi bitir' : `${pieces.length - done.length} profil kaldı`}
              </button>
              {(finished || done.length > 1) && <button type="button" onClick={reset} aria-label="Baştan başlat" className="grid h-12 w-12 place-items-center rounded-[10px] text-[var(--x-muted)] shadow-[inset_0_0_0_1px_var(--x-line)] hover:bg-[var(--x-surface-hover)]"><RotateCcw size={16} /></button>}
            </div>
          </div>
        </div>
      </div>

      {/* Office view of the same record */}
      <div className="x-window">
        <div className="flex items-center justify-between border-b border-[var(--x-line)] bg-[var(--x-surface-sunk)] px-4 py-2.5 text-[12px]">
          <span className="font-medium">Ofis · Siparişler</span>
          <span className="flex items-center gap-1.5 text-[var(--x-muted)]"><span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--x-ok)] opacity-50 motion-reduce:hidden" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--x-ok)]" /></span>Canlı</span>
        </div>
        <ul className="text-[12.5px]">
          {ORDERS.slice(0, 4).map((o) => {
            const me = o.id === ORDER.id;
            return (
              <li key={o.id} className={cn('grid grid-cols-[72px_1fr_auto] items-center gap-3 border-b border-[var(--x-line)] px-4 py-2.5', me && 'bg-[var(--x-bronze-soft)]')}>
                <span className="x-mono text-[var(--x-bronze)]">{o.id}</span>
                <span className="min-w-0 truncate">{o.customer}</span>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={me ? String(finished) : o.stage} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={T.base}>
                    <StageLabel stage={me ? (finished ? 'assembly' : 'cutting') : o.stage} />
                  </motion.span>
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
        <div className="px-4 pb-4 pt-3">
          <p className="text-[12px] font-medium">{ORDER.id} hareketleri</p>
          <ul className="mt-2 space-y-1.5" aria-live="polite">
            <AnimatePresence initial={false}>
              {log.map((entry) => (
                <motion.li key={entry.t + entry.text} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={T.base} className="grid grid-cols-[42px_1fr] gap-2 text-[12px]">
                  <span className="x-num text-[var(--x-faint)]">{entry.t}</span>
                  <span className="text-[var(--x-ink-2)]">{entry.text}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      </div>
    </div>
  );
}
