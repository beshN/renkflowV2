'use client';

import { WorkOrder, WORK_ORDER_STATUSES, WorkOrderStatus } from '@/lib/features/work-orders/client';
import type { WorkOrdersCopy } from '@/lib/features/work-orders/ui-copy';
import { WorkOrderPriorityPill, WorkOrderStatusPill } from './WorkOrderPills';
import { Button } from '@/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { ArrowRight } from 'lucide-react';

type WorkOrderListPanelProps = {
  workOrders: WorkOrder[];
  locale: string;
  copy: WorkOrdersCopy;
  isLoading: boolean;
  updatingWorkOrderId: string | null;
  onOpenDetails: (workOrderId: string) => void;
  onQuickStatusChange: (workOrderId: string, status: WorkOrderStatus) => void;
};

function formatDueDate(value: string | null, locale: string, emptyLabel: string): string {
  if (!value) return emptyLabel;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return emptyLabel;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function ChecklistProgress({ total, completed }: { total: number; completed: number }) {
  if (total === 0) {
    return <span className="text-xs text-slate-500 dark:text-slate-400">-</span>;
  }

  const percentage = Math.round((completed / total) * 100);
  return (
    <div className="space-y-1 min-w-[90px]">
      <p className="text-xs text-slate-600 dark:text-slate-300">
        {completed}/{total}
      </p>
      <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-emerald-500"
          style={{ width: `${Math.max(0, Math.min(percentage, 100))}%` }}
        />
      </div>
    </div>
  );
}

export function WorkOrderListPanel({
  workOrders,
  locale,
  copy,
  isLoading,
  updatingWorkOrderId,
  onOpenDetails,
  onQuickStatusChange,
}: WorkOrderListPanelProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-48 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-14 rounded bg-slate-100 dark:bg-slate-900" />
          <div className="h-14 rounded bg-slate-100 dark:bg-slate-900" />
          <div className="h-14 rounded bg-slate-100 dark:bg-slate-900" />
        </div>
      </div>
    );
  }

  if (workOrders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 p-10 text-center">
        <p className="text-lg font-semibold text-slate-900 dark:text-white">{copy.emptyTitle}</p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{copy.emptyDescription}</p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 overflow-hidden">
      <div className="p-4 border-b border-slate-200/70 dark:border-slate-800">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">{copy.pageTitle}</h2>
      </div>

      <div className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{copy.table.title}</TableHead>
              <TableHead>{copy.table.status}</TableHead>
              <TableHead>{copy.table.priority}</TableHead>
              <TableHead>{copy.table.dueAt}</TableHead>
              <TableHead>{copy.table.assignee}</TableHead>
              <TableHead>{copy.table.checklist}</TableHead>
              <TableHead>{copy.table.comments}</TableHead>
              <TableHead className="text-right">{copy.table.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workOrders.map((item) => {
              const isUpdating = updatingWorkOrderId === item.id;
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {item.category} • #{item.id.slice(0, 8)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <select
                      value={item.status}
                      onChange={(event) =>
                        onQuickStatusChange(item.id, event.target.value as WorkOrderStatus)
                      }
                      disabled={isUpdating}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    >
                      {WORK_ORDER_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {copy.statusLabels[status]}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2">
                      <WorkOrderStatusPill status={item.status} label={copy.statusLabels[item.status]} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <WorkOrderPriorityPill
                      priority={item.priority}
                      label={copy.priorityLabels[item.priority]}
                    />
                  </TableCell>
                  <TableCell className="text-xs">{formatDueDate(item.dueAt, locale, copy.table.noDueDate)}</TableCell>
                  <TableCell className="text-xs">
                    {item.assigneeName || copy.table.noAssignee}
                  </TableCell>
                  <TableCell>
                    <ChecklistProgress total={item.checklistTotal} completed={item.checklistCompleted} />
                  </TableCell>
                  <TableCell>{item.commentTotal}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenDetails(item.id)}
                      rightIcon={<ArrowRight size={14} />}
                    >
                      {copy.table.details}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="lg:hidden divide-y divide-slate-200/70 dark:divide-slate-800">
        {workOrders.map((item) => {
          const isUpdating = updatingWorkOrderId === item.id;
          return (
            <article key={item.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {item.category} • #{item.id.slice(0, 8)}
                  </p>
                </div>
                <WorkOrderPriorityPill
                  priority={item.priority}
                  label={copy.priorityLabels[item.priority]}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <WorkOrderStatusPill status={item.status} label={copy.statusLabels[item.status]} />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {copy.table.dueAt}: {formatDueDate(item.dueAt, locale, copy.table.noDueDate)}
                </span>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300">
                {copy.table.assignee}: {item.assigneeName || copy.table.noAssignee}
              </div>

              <ChecklistProgress total={item.checklistTotal} completed={item.checklistCompleted} />

              <div className="flex items-center gap-2">
                <select
                  value={item.status}
                  onChange={(event) => onQuickStatusChange(item.id, event.target.value as WorkOrderStatus)}
                  disabled={isUpdating}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  {WORK_ORDER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {copy.statusLabels[status]}
                    </option>
                  ))}
                </select>
                <Button variant="outline" size="sm" onClick={() => onOpenDetails(item.id)}>
                  {copy.table.details}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
