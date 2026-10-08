import type { LucideIcon } from 'lucide-react';
import { CircleDot } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TimelineItem = { id: string; when: string; title: React.ReactNode; detail?: React.ReactNode; icon?: LucideIcon; tone?: 'neutral' | 'in' | 'out' | 'warning' };
const TONE = { neutral: 'text-muted-foreground', in: 'text-emerald-700 dark:text-emerald-300', out: 'text-rose-700 dark:text-rose-300', warning: 'text-amber-700 dark:text-amber-300' };

/** A vertical line of events, newest first: stock movements, order history. */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn('relative space-y-3 border-l border-border pl-4', className)}>
      {items.map((it) => {
        const Icon = it.icon ?? CircleDot;
        return (
          <li key={it.id} className="relative">
            <span className={cn('absolute -left-[25px] top-0.5 grid h-4 w-4 place-items-center rounded-full bg-background', TONE[it.tone ?? 'neutral'])}><Icon size={14} aria-hidden /></span>
            <p className="text-sm font-medium leading-5">{it.title}</p>
            <p className="text-[11px] text-muted-foreground">{it.when}{it.detail ? <> · {it.detail}</> : null}</p>
          </li>
        );
      })}
    </ol>
  );
}
