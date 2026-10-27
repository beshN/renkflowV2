'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Share2, X } from 'lucide-react';
import { toast } from 'sonner';
import { celebrate } from './celebrate';
import { ORDER_MILESTONES, milestoneLine, milestoneOrdinal, milestoneShareText, milestoneStorageKey, milestoneToShow } from '@/lib/spells/milestones';

const RAL = ['#f1f0ea', '#a5a8a6', '#4a5256', '#6b4a3a', 'var(--acc-chrome, #c9a07a)'];
const BURST = ['#c9a07a', '#4a5256', '#a5a8a6', '#6b4a3a', '#e4e6ea', '#7b818c'];

/** Which milestone this browser should celebrate; null when storage is unreadable (no repeat shows). */
function pick(tenantId: string, count: number) {
  try {
    const seen = ORDER_MILESTONES.filter((m) => localStorage.getItem(milestoneStorageKey(tenantId, m)));
    const milestone = milestoneToShow(count, seen);
    if (milestone) for (const m of ORDER_MILESTONES) if (m <= milestone) localStorage.setItem(milestoneStorageKey(tenantId, m), new Date().toISOString());
    return milestone;
  } catch {
    return null;
  }
}

/**
 * One-time card when the firm reaches its 10th, 100th, 1.000th or 10.000th order.
 * Remembered per browser, tenant and milestone; nothing is written to the server.
 */
export default function OrderMilestone({ tenantId, count }: { tenantId: string; count: number }) {
  const reduce = useReducedMotion();
  const [milestone, setMilestone] = useState<number | null>(null);
  const ref = useRef<HTMLElement>(null);
  // Picking also marks the milestone as seen, so it must run once per tenant and count (Strict Mode replays effects).
  const picked = useRef('');

  useEffect(() => {
    const key = `${tenantId}:${count}`;
    if (picked.current === key) return;
    picked.current = key;
    const next = pick(tenantId, count);
    if (next) setMilestone(next);
  }, [tenantId, count]);

  useEffect(() => {
    if (!milestone) return;
    const timers = [0, 260, 520].map((delay, i) => window.setTimeout(() => {
      const rect = ref.current?.getBoundingClientRect();
      const x = rect ? rect.left + rect.width * (0.25 + i * 0.25) : window.innerWidth / 2;
      const y = rect ? rect.top + Math.min(rect.height / 2, 60) : window.innerHeight * 0.3;
      celebrate({ x, y }, { pieces: 34, tones: BURST, spread: 1.35 });
    }, delay + 250));
    return () => timers.forEach(clearTimeout);
  }, [milestone]);

  const share = async () => {
    if (!milestone) return;
    const text = milestoneShareText(milestone);
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: 'RenkFlow', text }); return; }
      catch (error) { if ((error as Error)?.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Paylaşım metni kopyalandı', { description: text });
    } catch {
      toast.message('Paylaşım metni', { description: text });
    }
  };

  const ordinal = milestone ? milestoneOrdinal(milestone) : '';
  const date = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  return (
    <AnimatePresence>
      {milestone && (
        <motion.section
          ref={ref}
          aria-labelledby="rf-milestone-title"
          aria-live="polite"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="rf-panel relative overflow-hidden !p-0"
        >
          <div aria-hidden className="flex h-1.5">{RAL.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}</div>
          <button type="button" onClick={() => setMilestone(null)} aria-label="Kutlamayı kapat" className="rf-icon-button absolute right-2 top-3.5 grid h-8 w-8 place-items-center"><X size={16} /></button>
          <div className="flex flex-col gap-4 p-5 pr-12 sm:flex-row sm:items-center sm:gap-6">
            <div aria-hidden className="relative grid h-[72px] min-w-[72px] shrink-0 place-items-center self-start rounded-xl bg-gradient-to-br from-[#2e3538] to-[#4a5256] px-3 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] ring-1 ring-black/5 dark:ring-white/15 sm:self-center">
              <span className="text-[26px] font-semibold leading-none tracking-[-0.04em] tabular-nums">{milestone.toLocaleString('tr-TR')}</span>
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--acc-chrome,#c9a07a)] px-2 py-0.5 text-[10px] font-semibold tracking-[0.04em] text-[#1e2427]">iş</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Kilometre taşı · <time dateTime={new Date().toISOString().slice(0, 10)}>{date}</time></p>
              <h2 id="rf-milestone-title" className="mt-1 text-[21px] font-semibold leading-tight tracking-[-0.03em] text-foreground">Atölyenizin {ordinal} işi!</h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{milestoneLine(milestone)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => void share()} className="rf-primary-button inline-flex h-9 items-center gap-1.5 px-3.5 text-xs"><Share2 size={14} aria-hidden /> Paylaş</button>
                <button type="button" onClick={() => setMilestone(null)} className="rf-secondary-button h-9 px-3.5 text-xs">Teşekkürler</button>
              </div>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
