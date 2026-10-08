import { cn } from '@/lib/utils';

/** A ring that fills with progress; the number sits in the middle (e.g. pieces left). */
export function ProgressRing({ value, max, size = 56, stroke = 6, label, center, className }: {
  value: number; max: number; size?: number; stroke?: number; label: string; center?: React.ReactNode; className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center', className)} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} className="transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none" />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-semibold tabular-nums">{center ?? `${Math.round(ratio * 100)}%`}</span>
    </span>
  );
}
