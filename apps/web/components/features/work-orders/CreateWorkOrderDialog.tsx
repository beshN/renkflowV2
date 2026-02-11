'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  createWorkOrder,
  TenantMember,
  WORK_ORDER_PRIORITIES,
  WorkOrder,
  WorkOrderClientError,
} from '@/lib/features/work-orders/client';
import type { WorkOrdersCopy } from '@/lib/features/work-orders/ui-copy';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type CreateWorkOrderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: TenantMember[];
  copy: WorkOrdersCopy;
  onCreated: (workOrder: WorkOrder) => void;
};

type CreateFormState = {
  title: string;
  description: string;
  category: string;
  priority: (typeof WORK_ORDER_PRIORITIES)[number];
  dueAt: string;
  location: string;
  assetTag: string;
  estimatedMinutes: string;
  assignedToUserId: string;
  checklist: string;
};

const defaultFormState: CreateFormState = {
  title: '',
  description: '',
  category: 'general',
  priority: 'medium',
  dueAt: '',
  location: '',
  assetTag: '',
  estimatedMinutes: '',
  assignedToUserId: '',
  checklist: '',
};

function toIsoDate(input: string): string | undefined {
  if (!input) return undefined;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function parseChecklist(value: string): Array<{ title: string; required: boolean }> {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((title) => ({ title, required: true }));
}

export function CreateWorkOrderDialog({
  open,
  onOpenChange,
  members,
  copy,
  onCreated,
}: CreateWorkOrderDialogProps) {
  const [form, setForm] = useState<CreateFormState>(defaultFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(defaultFormState);
      setError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  const canSubmit = useMemo(() => form.title.trim().length >= 3 && !isSubmitting, [form.title, isSubmitting]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (form.title.trim().length < 3) {
      setError(copy.form.titleRequired);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const estimatedMinutes = form.estimatedMinutes.trim()
        ? Number(form.estimatedMinutes.trim())
        : undefined;

      const workOrder = await createWorkOrder({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.category.trim() || 'general',
        priority: form.priority,
        dueAt: toIsoDate(form.dueAt),
        location: form.location.trim() || undefined,
        assetTag: form.assetTag.trim() || undefined,
        estimatedMinutes:
          typeof estimatedMinutes === 'number' && Number.isFinite(estimatedMinutes) && estimatedMinutes > 0
            ? Math.round(estimatedMinutes)
            : undefined,
        assignedToUserId: form.assignedToUserId || undefined,
        checklist: parseChecklist(form.checklist),
      });

      onCreated(workOrder);
      onOpenChange(false);
    } catch (submitError) {
      if (submitError instanceof WorkOrderClientError) {
        setError(submitError.message);
      } else {
        setError(copy.toast.genericError);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden p-0">
        <form onSubmit={handleSubmit} className="flex h-full max-h-[90vh] flex-col">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>{copy.createButton}</DialogTitle>
            <DialogDescription>{copy.subtitle}</DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto px-6 py-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                required
                label={copy.form.title}
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder={copy.form.title}
              />

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{copy.form.category}</label>
                <input
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{copy.form.description}</label>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                rows={4}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{copy.form.priority}</label>
                <select
                  value={form.priority}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      priority: event.target.value as (typeof WORK_ORDER_PRIORITIES)[number],
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  {WORK_ORDER_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {copy.priorityLabels[priority]}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                type="datetime-local"
                label={copy.form.dueAt}
                value={form.dueAt}
                onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label={copy.form.location}
                value={form.location}
                onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
              />
              <Input
                label={copy.form.assetTag}
                value={form.assetTag}
                onChange={(event) => setForm((current) => ({ ...current, assetTag: event.target.value }))}
              />
              <Input
                type="number"
                min={1}
                step={1}
                label={copy.form.estimatedMinutes}
                value={form.estimatedMinutes}
                onChange={(event) => setForm((current) => ({ ...current, estimatedMinutes: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{copy.form.assignedTo}</label>
              <select
                value={form.assignedToUserId}
                onChange={(event) => setForm((current) => ({ ...current, assignedToUserId: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              >
                <option value="">{copy.detail.unassigned}</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{copy.form.checklist}</label>
              <textarea
                value={form.checklist}
                onChange={(event) => setForm((current) => ({ ...current, checklist: event.target.value }))}
                rows={5}
                placeholder={copy.form.checklistHint}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">{copy.form.checklistHint}</p>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </div>
            ) : null}
          </div>

          <DialogFooter className="border-t border-slate-200/70 dark:border-slate-800 px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {copy.form.cancel}
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={!canSubmit}>
              {copy.form.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
