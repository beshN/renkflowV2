'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

/** A line of recent values (no axes); the last point is marked. */
export function Sparkline({ values, width = 96, height = 28, label, className }: { values: number[]; width?: number; height?: number; label: string; className?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values), min = Math.min(...values), span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 4) + 2, height - 3 - ((v - min) / span) * (height - 6)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className={cn('text-primary', className)}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2.5" fill="currentColor" />
    </svg>
  );
}

export type BarItem = { key: string; label: string; value: number; href?: string; tone?: 'primary' | 'danger' | 'muted' };
const BAR_TONE = { primary: 'bg-primary', danger: 'bg-rose-600', muted: 'bg-muted-foreground/40' };

/** Columns per item; each column is a link to the list it counts. */
export function BarMini({ items, height = 64, className }: { items: BarItem[]; height?: number; className?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className={cn('flex items-end gap-1.5', className)} style={{ height: height + 30 }}>
      {items.map((it) => {
        const bar = (
          <>
            <span className="text-[11px] font-semibold tabular-nums">{it.value}</span>
            <span className={cn('w-full rounded-sm', BAR_TONE[it.tone ?? 'primary'])} style={{ height: Math.max(3, (it.value / max) * height) }} />
            <span className="w-full truncate text-center text-[10px] text-muted-foreground">{it.label}</span>
          </>
        );
        const cls = 'flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-md px-0.5 hover:bg-accent/60';
        return <li key={it.key} className="flex h-full min-w-0 flex-1">{it.href ? <Link href={it.href} className={cls} aria-label={`${it.label}: ${it.value}`}>{bar}</Link> : <span className={cls}>{bar}</span>}</li>;
      })}
    </ul>
  );
}

export type DonutSegment = { key: string; label: string; value: number; color: string; href?: string };

/** Share of a whole; each segment and legend row opens its list. */
export function Donut({ segments, size = 112, stroke = 16, center, className }: { segments: DonutSegment[]; size?: number; stroke?: number; center?: React.ReactNode; className?: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className={cn('flex items-center gap-4', className)}>
      <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(', ')}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
          {total > 0 && segments.filter((s) => s.value > 0).map((s) => {
            const len = (s.value / total) * c;
            const el = <circle key={s.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke} strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-offset} />;
            offset += len;
            return el;
          })}
        </svg>
        <span className="absolute inset-0 grid place-items-center text-lg font-semibold tabular-nums">{center ?? total}</span>
      </span>
      <ul className="min-w-0 space-y-1 text-xs">
        {segments.map((s) => {
          const row = <><span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} /><span className="truncate">{s.label}</span><span className="ml-auto pl-2 font-semibold tabular-nums">{s.value}</span></>;
          return <li key={s.key}>{s.href ? <Link href={s.href} className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-accent">{row}</Link> : <span className="flex items-center gap-1.5 px-1 py-0.5">{row}</span>}</li>;
        })}
      </ul>
    </div>
  );
}
