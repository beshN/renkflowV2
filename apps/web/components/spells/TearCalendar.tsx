'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

function parts(date: Date) {
  const day = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric' }).format(date);
  const month = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', month: 'short' }).format(date).replace('.', '').toLocaleUpperCase('tr-TR');
  return { day, month };
}

/**
 * Tear-off desk calendar (after the Chengyu Calendar spell). Click to tear today's
 * page; it falls away and a fresh copy settles back in.
 */
export function TearCalendar({ date = new Date() }: { date?: Date }) {
  const reduce = useReducedMotion();
  const [tears, setTears] = useState(0);
  const { day, month } = parts(date);
  const page = (
    <>
      <span className="block bg-[hsl(var(--rf-ink))] py-[3px] text-center font-mono text-[8.5px] font-medium tracking-[0.12em] text-[hsl(var(--rf-ink-foreground))]">{month}</span>
      <span className="block pb-1 pt-0.5 text-center text-[19px] font-semibold leading-none tracking-[-0.04em] tabular-nums">{day}</span>
    </>
  );
  return (
    <button
      type="button"
      onClick={() => setTears((n) => n + 1)}
      title="Yaprağı kopar"
      aria-label={`Bugün ${day} ${month}`}
      className="group relative h-[46px] w-[42px] shrink-0 [perspective:300px]"
    >
      <span aria-hidden className="absolute inset-0 translate-y-[3px] scale-[0.94] rounded-[7px] border border-border bg-card" />
      <span aria-hidden className="absolute inset-0 translate-y-[1.5px] scale-[0.97] rounded-[7px] border border-border bg-card" />
      <AnimatePresence initial={false}>
        <motion.span
          key={tears}
          className="absolute inset-0 overflow-hidden rounded-[7px] border border-border bg-card shadow-[0_1px_2px_rgb(17_17_19/0.06)] transition-transform duration-300 [transform-origin:top] group-hover:[transform:rotateX(-14deg)]"
          initial={reduce ? false : { y: -6, opacity: 0 }}
          animate={{ y: 0, opacity: 1, transition: { duration: 0.3, delay: 0.15 } }}
          exit={reduce ? { opacity: 0 } : { y: 46, rotate: tears % 2 ? 18 : -18, opacity: 0, transition: { duration: 0.55, ease: [0.4, 0, 1, 1] } }}
        >
          {page}
          <span aria-hidden className="absolute inset-x-1 top-[15px] border-t border-dashed border-border" />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
