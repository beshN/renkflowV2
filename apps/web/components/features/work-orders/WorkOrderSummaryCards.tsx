'use client';

import { WorkOrderSummary } from '@/lib/features/work-orders/client';
import type { WorkOrdersCopy } from '@/lib/features/work-orders/ui-copy';
import { Card } from '@/components/ui/Card';

type WorkOrderSummaryCardsProps = {
  summary: WorkOrderSummary | null;
  copy: WorkOrdersCopy;
  locale: string;
};

function formatDecimal(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value);
}

export function WorkOrderSummaryCards({ summary, copy, locale }: WorkOrderSummaryCardsProps) {
  const value = (input: number | undefined): string => {
    if (typeof input !== 'number') return '-';
    return new Intl.NumberFormat(locale).format(input);
  };

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <Card spotlight padding="sm" className="p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{copy.summary.total}</p>
        <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{value(summary?.total)}</p>
      </Card>

      <Card spotlight padding="sm" className="p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{copy.summary.open}</p>
        <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{value(summary?.byStatus.open)}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {copy.summary.inProgress}: {value(summary?.byStatus.inProgress)} • {copy.summary.blocked}: {value(summary?.byStatus.blocked)}
        </p>
      </Card>

      <Card spotlight padding="sm" className="p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{copy.summary.overdue}</p>
        <p className="mt-2 text-3xl font-bold text-rose-600 dark:text-rose-300">{value(summary?.overdue)}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {copy.summary.dueToday}: {value(summary?.dueToday)}
        </p>
      </Card>

      <Card spotlight padding="sm" className="p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{copy.summary.completionRate7d}</p>
        <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-300">
          {summary ? `${formatDecimal(summary.throughput.completionRate7d, locale)}%` : '-'}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {copy.summary.avgResolutionHours}: {summary ? formatDecimal(summary.avgResolutionHours30d, locale) : '-'}
        </p>
      </Card>
    </section>
  );
}
