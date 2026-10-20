import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sparkline } from './MiniChart';
import { Skeleton } from './Skeleton';

const TONE = {
  neutral: { value: 'text-foreground', chip: 'text-muted-foreground' },
  danger: { value: 'text-rose-700 dark:text-rose-300', chip: 'text-rose-600' },
  warning: { value: 'text-amber-700 dark:text-amber-300', chip: 'text-amber-600' },
  success: { value: 'text-emerald-700 dark:text-emerald-300', chip: 'text-emerald-600' },
};

/** A number people act on: label, value, optional trend; the whole card opens its list. */
export function StatCard({ label, value, icon: Icon, trend, href, tone = 'neutral', loading, className }: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  trend?: number[];
  href?: string;
  tone?: keyof typeof TONE;
  loading?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
        {label}
        {Icon && <Icon size={16} aria-hidden className={TONE[tone].chip} />}
      </span>
      <span className="mt-3 flex items-end justify-between gap-2">
        {loading ? <Skeleton className="h-9 w-14" /> : <span className={cn('rf-metric-value', TONE[tone].value)}>{value}</span>}
        {trend && !loading && <Sparkline values={trend} label={`${label} eğilimi`} />}
      </span>
    </>
  );
  const cls = cn('rf-metric flex flex-col', className);
  return href ? <Link href={href} className={cn(cls, 'group hover:border-primary/40')}>{body}</Link> : <div className={cls}>{body}</div>;
}
