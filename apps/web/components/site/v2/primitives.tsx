'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { colorInfo } from '@/lib/features/colors/color-spec';
import { cn } from '@/lib/utils';
import { STAGE_COLOR, STAGES, stageIndex, type StageKey } from './model';

export const EASE = [0.2, 0.8, 0.2, 1] as const;
export const T = {
  fast: { duration: 0.12, ease: EASE },
  base: { duration: 0.2, ease: EASE },
  slow: { duration: 0.32, ease: EASE },
  indicator: { type: 'spring', stiffness: 520, damping: 42, mass: 0.8 },
} as const;

type TabItem<K extends string> = { key: K; label: ReactNode; count?: number };

/**
 * Tabs with a sliding indicator. Arrow keys move between tabs (roving focus), as in the workspace.
 * `underline` sits on a hairline; `segmented` is a pill group for view switches.
 */
export function Tabs<K extends string>({ items, value, onChange, id, label, variant = 'underline', className, size = 'md' }: {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  id: string;
  label: string;
  variant?: 'underline' | 'segmented';
  className?: string;
  size?: 'sm' | 'md';
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKey = (event: KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + items.length) % items.length;
    refs.current[next]?.focus();
    onChange(items[next].key);
  };
  const segmented = variant === 'segmented';
  return (
    <div role="tablist" aria-label={label} className={cn(segmented ? 'inline-flex rounded-[var(--x-r-control)] bg-[var(--x-surface-sunk)] p-[3px] shadow-[inset_0_0_0_1px_var(--x-line)]' : 'flex gap-5 shadow-[inset_0_-1px_0_var(--x-line)]', className)}>
      {items.map((item, index) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            ref={(el) => { refs.current[index] = el; }}
            role="tab"
            type="button"
            id={`${id}-tab-${item.key}`}
            aria-selected={active}
            aria-controls={`${id}-panel`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.key)}
            onKeyDown={(e) => onKey(e, index)}
            className={cn(
              'relative inline-flex items-center gap-1.5 whitespace-nowrap font-medium transition-colors duration-[120ms]',
              segmented ? cn('rounded-[5px] px-2.5', size === 'sm' ? 'h-6 text-[12px]' : 'h-7 text-[12.5px]') : cn('pb-2.5 pt-1', size === 'sm' ? 'text-[12px]' : 'text-[13px]'),
              active ? 'text-[var(--x-ink)]' : 'text-[var(--x-muted)] hover:text-[var(--x-ink)]',
            )}
          >
            {active && (
              <motion.span
                layoutId={`${id}-indicator`}
                transition={T.indicator}
                className={segmented ? 'absolute inset-0 rounded-[5px] bg-[var(--x-surface)] shadow-[0_1px_2px_rgb(20_26_28/0.1),0_0_0_1px_var(--x-line)]' : 'absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[var(--x-ink)]'}
              />
            )}
            <span className="relative">{item.label}</span>
            {item.count !== undefined && <span className="x-num relative text-[11px] text-[var(--x-faint)]">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function StageDot({ stage, className }: { stage: StageKey; className?: string }) {
  return <span aria-hidden className={cn('inline-block h-2 w-2 shrink-0 rounded-full', className)} style={{ background: STAGE_COLOR[stage] }} />;
}

export function StageLabel({ stage, className }: { stage: StageKey; className?: string }) {
  const label = STAGES[stageIndex(stage)].label;
  return <span className={cn('inline-flex items-center gap-1.5 text-[12px] text-[var(--x-ink-2)]', className)}><StageDot stage={stage} />{label}</span>;
}

/** Six-step strip: filled up to the current step, the current one in bronze. */
export function StageStrip({ stage, className }: { stage: StageKey; className?: string }) {
  const at = stageIndex(stage);
  return (
    <ol className={cn('grid grid-cols-6 gap-1', className)} aria-label={`Aşama: ${STAGES[at].label}`}>
      {STAGES.map((step, i) => (
        <li key={step.key} aria-current={i === at ? 'step' : undefined} className="min-w-0">
          <span className="relative block h-[3px] overflow-hidden rounded-full bg-[var(--x-line)]">
            <motion.span
              className="absolute inset-0 origin-left rounded-full"
              style={{ background: i === at ? 'var(--x-bronze-fill)' : 'var(--x-ink-2)' }}
              initial={false}
              animate={{ scaleX: i <= at ? 1 : 0 }}
              transition={{ ...T.slow, delay: i <= at ? i * 0.03 : 0 }}
            />
          </span>
          <span className={cn('mt-1.5 block truncate text-[11px]', i === at ? 'font-semibold text-[var(--x-ink)]' : i < at ? 'text-[var(--x-ink-2)]' : 'text-[var(--x-faint)]')}>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

/** Colour chip with the RAL code, using the same colour table as the workspace. */
export function Swatch({ color, withLabel = true, className }: { color: string; withLabel?: boolean; className?: string }) {
  const info = colorInfo(color);
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <span aria-hidden className="h-3 w-3 shrink-0 rounded-[3px] shadow-[inset_0_0_0_1px_var(--x-swatch-ring)]" style={{ background: info?.hex ?? '#9aa1a9' }} />
      {withLabel && <span className="truncate">{info?.code ?? color}{info?.finish && !info.finishAssumed ? ` ${info.finish}` : ''}</span>}
    </span>
  );
}

/** A number that runs to its new value, so a change reads as a change; instant with reduced motion. */
export function Ticker({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduce) { setShown(value); from.current = value; return; }
    const controls = animate(from.current, value, { duration: 0.42, ease: EASE, onUpdate: setShown });
    from.current = value;
    return () => controls.stop();
  }, [value, reduce]);
  return <span className={cn('x-num', className)}>{format(shown)}</span>;
}

/** Re-runs the bronze wash on its child whenever `watch` changes. */
export function Flash({ watch, children, className }: { watch: unknown; children: ReactNode; className?: string }) {
  const [tick, setTick] = useState(0);
  const first = useRef(true);
  const key = JSON.stringify(watch);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setTick((t) => t + 1);
  }, [key]);
  return <span key={tick} className={cn(tick ? 'x-flash' : '', 'rounded-[3px]', className)}>{children}</span>;
}

export function Initials({ name }: { name: string }) {
  const text = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2);
  return <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--x-surface-sunk)] text-[9.5px] font-semibold text-[var(--x-ink-2)] shadow-[inset_0_0_0_1px_var(--x-line)]">{text}</span>;
}
