import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HintTip } from './HintTip';

export type Kpi = { label: string; value: React.ReactNode; icon?: LucideIcon; href?: string; tone?: 'neutral' | 'danger' | 'warning' | 'success' };
const TONE: Record<NonNullable<Kpi['tone']>, string> = {
  neutral: 'text-foreground',
  danger: 'text-rose-700 dark:text-rose-300',
  warning: 'text-amber-700 dark:text-amber-300',
  success: 'text-emerald-700 dark:text-emerald-300',
};

/**
 * One header per page: eyebrow, a single h1, a live KPI strip (each KPI opens its list) and one
 * primary action. Explanations live in the (i) tip, not in sentences under the title.
 */
export function PageHeader({ eyebrow, title, hint, kpis, action, className }: {
  eyebrow?: React.ReactNode;
  title: string;
  hint?: string;
  kpis?: Kpi[];
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('space-y-3 border-b border-border pb-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="rf-eyebrow">{eyebrow}</p>}
          <h1 className="rf-page-title flex items-center gap-2">{title}{hint && <HintTip text={hint} />}</h1>
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
      {kpis && kpis.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Özet">
          {kpis.map((k) => {
            const body = (
              <>
                {k.icon && <k.icon size={14} aria-hidden className="text-muted-foreground" />}
                <span className={cn('text-base font-semibold tabular-nums', TONE[k.tone ?? 'neutral'])}>{k.value}</span>
                <span className="text-xs text-muted-foreground">{k.label}</span>
              </>
            );
            const cls = 'inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-card px-2.5';
            return <li key={k.label}>{k.href ? <Link href={k.href} className={cn(cls, 'hover:border-primary/50')}>{body}</Link> : <span className={cls}>{body}</span>}</li>;
          })}
        </ul>
      )}
    </header>
  );
}
