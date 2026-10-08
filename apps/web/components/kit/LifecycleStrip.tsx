import { Check, Pause, X } from 'lucide-react';
import { LIFECYCLE, lifecycleIndex } from '@/lib/features/orders/lifecycle';
import { normalizeOrderStatus } from '@/lib/features/orders/workspace';
import { cn } from '@/lib/utils';

/**
 * Teklif → Onay → Üretim → Kesim → Montaj → Teslim on one line: done steps filled with a check,
 * the current one outlined, later ones empty. On hold / cancelled show their own mark.
 */
export function LifecycleStrip({ status, compact = false, className }: { status: string; compact?: boolean; className?: string }) {
  const s = normalizeOrderStatus(status);
  const at = lifecycleIndex(s);
  const delivered = s === 'completed';
  if (s === 'on_hold' || s === 'cancelled') {
    const Icon = s === 'on_hold' ? Pause : X;
    return <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground', className)}><Icon size={12} aria-hidden />{s === 'on_hold' ? 'Beklemede' : 'İptal'}</span>;
  }
  return (
    <ol className={cn('flex w-full items-center', className)} aria-label={`Aşama: ${LIFECYCLE[Math.max(0, at)].label}`}>
      {LIFECYCLE.map((step, i) => {
        const done = i < at || delivered;
        const current = i === at && !delivered;
        return (
          <li key={step.key} className="flex min-w-0 flex-1 items-center last:flex-none" aria-current={current ? 'step' : undefined}>
            <span title={step.label} className={cn('grid shrink-0 place-items-center rounded-full border', compact ? 'h-3.5 w-3.5' : 'h-5 w-5',
              done ? 'border-primary bg-primary text-primary-foreground' : current ? 'border-primary bg-background text-primary ring-2 ring-primary/25' : 'border-border bg-background')}>
              {done && <Check size={compact ? 9 : 12} strokeWidth={3} aria-hidden />}
              {current && <span aria-hidden className={cn('rounded-full bg-primary', compact ? 'h-1.5 w-1.5' : 'h-2 w-2')} />}
            </span>
            {!compact && <span className={cn('ml-1 hidden truncate text-[10px] sm:inline', current ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{step.label}</span>}
            {i < LIFECYCLE.length - 1 && <span aria-hidden className={cn('mx-1 h-0.5 min-w-2 flex-1 rounded', i < at || delivered ? 'bg-primary' : 'bg-border')} />}
          </li>
        );
      })}
    </ol>
  );
}
