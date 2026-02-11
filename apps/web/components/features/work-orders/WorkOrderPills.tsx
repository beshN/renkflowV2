'use client';

import { cn } from '@/lib/utils';
import type { WorkOrderPriority, WorkOrderStatus } from '@/lib/features/work-orders/client';

type WorkOrderPillProps = {
  className?: string;
};

const statusStyles: Record<WorkOrderStatus, string> = {
  open: 'bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-200',
  in_progress: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  blocked: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  cancelled: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

const priorityStyles: Record<WorkOrderPriority, string> = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-200',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export function WorkOrderStatusPill({
  status,
  label,
  className,
}: WorkOrderPillProps & { status: WorkOrderStatus; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ring-black/5 dark:ring-white/10',
        statusStyles[status],
        className
      )}
    >
      {label}
    </span>
  );
}

export function WorkOrderPriorityPill({
  priority,
  label,
  className,
}: WorkOrderPillProps & { priority: WorkOrderPriority; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ring-black/5 dark:ring-white/10',
        priorityStyles[priority],
        className
      )}
    >
      {label}
    </span>
  );
}
