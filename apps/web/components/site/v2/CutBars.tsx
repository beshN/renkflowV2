'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { CutBar } from '@/lib/features/manufacturing/cutting-engine';
import { cn } from '@/lib/utils';
import { fmt } from './model';
import { EASE } from './primitives';

const cm = (mm: number) => fmt(mm / 10, mm % 10 ? 1 : 0);

/**
 * One stock bar as the workshop reads it: cut pieces in ink with their length, a reusable remnant
 * in bronze (it goes back to the rack), saw and trim loss hatched. A remnant bar is marked as such.
 */
export function BarRow({ bar, scale, dense = false, index }: { bar: CutBar; scale: number; dense?: boolean; index?: number }) {
  const reduce = useReducedMotion();
  const length = bar.source.lengthMm;
  const pieceTotal = bar.pieces.reduce((n, p) => n + p.lengthMm, 0);
  const lossMm = Math.max(0, length - pieceTotal - (bar.reusable ? bar.remainingMm : 0));
  const label = `${bar.source.isRemnant ? 'Artık' : 'Çubuk'} ${cm(length)} cm: ${bar.pieces.map((p) => `${cm(p.lengthMm)} cm`).join(', ')}${bar.reusable ? `, ${cm(bar.remainingMm)} cm artık rafa döner` : ''}`;
  return (
    <div className="flex items-center gap-2.5">
      {index !== undefined && <span className="x-num w-5 shrink-0 text-right text-[11px] text-[var(--x-faint)]">{index}</span>}
      <div className="min-w-0 flex-1">
        <div role="img" aria-label={label} className={cn('flex overflow-hidden rounded-[3px] bg-[var(--x-surface-sunk)] shadow-[inset_0_0_0_1px_var(--x-line)]', dense ? 'h-5' : 'h-7')} style={{ width: `${(length / scale) * 100}%` }}>
          {bar.pieces.map((piece, i) => (
            <motion.span
              key={i}
              initial={{ scaleX: 0.6, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={reduce ? { duration: 0 } : { duration: 0.32, delay: i * 0.025, ease: EASE }}
              style={{ width: `${(piece.lengthMm / length) * 100}%`, originX: 0 }}
              className={cn('grid shrink-0 place-items-center border-r border-[var(--x-surface)] font-medium text-[var(--x-surface)]', bar.source.isRemnant ? 'bg-[var(--x-st-assembly)]' : 'bg-[var(--x-ink-2)]', dense ? 'text-[9.5px]' : 'text-[10.5px]')}
            >
              <span className="x-num truncate px-0.5">{piece.lengthMm / length > 0.09 ? cm(piece.lengthMm) : ''}</span>
            </motion.span>
          ))}
          {lossMm > 0 && <span className="x-hatch shrink-0" style={{ width: `${(lossMm / length) * 100}%` }} />}
          {bar.reusable && <span className={cn('grid min-w-0 flex-1 place-items-center bg-[var(--x-bronze-soft)] text-[var(--x-bronze)]', dense ? 'text-[9.5px]' : 'text-[10.5px]')}><span className="truncate px-1">{bar.remainingMm / length > 0.12 ? 'artık' : ''}</span></span>}
        </div>
      </div>
      {!dense && (
        <span className="x-num w-[86px] shrink-0 text-right text-[11px] text-[var(--x-muted)]">
          {bar.source.isRemnant ? 'artık ' : ''}{cm(length)} cm
        </span>
      )}
    </div>
  );
}
