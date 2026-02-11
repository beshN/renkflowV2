'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { WorkOrderPriorityPill, WorkOrderStatusPill } from '@/components/features/work-orders/WorkOrderPills';
import { useTranslation } from '@/lib/i18n/client';
import { useToast } from '@/lib/context/ToastContext';
import { useAuth } from '@/lib/context/AuthContext';
import {
  addWorkOrderComment,
  getWorkOrderDetails,
  listTenantMembers,
  toggleWorkOrderChecklistItem,
  updateWorkOrder,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  WorkOrderClientError,
  WorkOrderDetails,
  WorkOrderPriority,
  WorkOrderStatus,
  TenantMember,
  UpdateWorkOrderInput,
} from '@/lib/features/work-orders/client';
import { getWorkOrdersCopy } from '@/lib/features/work-orders/ui-copy';
import { ArrowLeft, Clock3, MapPin, PackageSearch, Send, Plus } from 'lucide-react';

type EditableFormState = {
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  dueAt: string;
  assignedToUserId: string;
  description: string;
  location: string;
  assetTag: string;
  estimatedMinutes: string;
  actualMinutes: string;
};

function formatDateTimeInput(value: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const localDate = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function formatDisplayDate(value: string | null, locale: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function parseNumberField(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.round(numeric);
}

function getInitialFormState(workOrder: WorkOrderDetails): EditableFormState {
  return {
    status: workOrder.status,
    priority: workOrder.priority,
    dueAt: formatDateTimeInput(workOrder.dueAt),
    assignedToUserId: workOrder.assignedTo || '',
    description: workOrder.description || '',
    location: workOrder.location || '',
    assetTag: workOrder.assetTag || '',
    estimatedMinutes: workOrder.estimatedMinutes?.toString() || '',
    actualMinutes: workOrder.actualMinutes?.toString() || '',
  };
}

function buildUpdatePayload(original: WorkOrderDetails, draft: EditableFormState): UpdateWorkOrderInput {
  const payload: UpdateWorkOrderInput = {};

  if (draft.status !== original.status) payload.status = draft.status;
  if (draft.priority !== original.priority) payload.priority = draft.priority;

  const dueAt = draft.dueAt ? new Date(draft.dueAt).toISOString() : null;
  if ((original.dueAt || null) !== dueAt) payload.dueAt = dueAt;

  const assignedTo = draft.assignedToUserId || null;
  if ((original.assignedTo || null) !== assignedTo) payload.assignedToUserId = assignedTo;

  const description = draft.description.trim() || null;
  if ((original.description || null) !== description) payload.description = description;

  const location = draft.location.trim() || null;
  if ((original.location || null) !== location) payload.location = location;

  const assetTag = draft.assetTag.trim() || null;
  if ((original.assetTag || null) !== assetTag) payload.assetTag = assetTag;

  const estimated = parseNumberField(draft.estimatedMinutes);
  if (estimated !== undefined && (original.estimatedMinutes || null) !== estimated) {
    payload.estimatedMinutes = estimated;
  }

  const actual = parseNumberField(draft.actualMinutes);
  if (actual !== undefined && (original.actualMinutes || null) !== actual) {
    payload.actualMinutes = actual;
  }

  return payload;
}

export default function WorkOrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ workOrderId: string }>();
  const workOrderId = params?.workOrderId;

  const { locale } = useTranslation();
  const copy = useMemo(() => getWorkOrdersCopy(locale), [locale]);
  const { showToast } = useToast();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [workOrder, setWorkOrder] = useState<WorkOrderDetails | null>(null);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingChecklistId, setUpdatingChecklistId] = useState<string | null>(null);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isAppendingChecklist, setIsAppendingChecklist] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [appendChecklistText, setAppendChecklistText] = useState('');
  const [form, setForm] = useState<EditableFormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDetails = useCallback(async () => {
    if (!workOrderId) return;
    setIsLoading(true);
    try {
      const detail = await getWorkOrderDetails(workOrderId);
      setWorkOrder(detail);
      setForm(getInitialFormState(detail));
      setError(null);
    } catch (loadError) {
      if (loadError instanceof WorkOrderClientError) {
        setError(loadError.message);
      } else {
        setError(copy.loadError);
      }
    } finally {
      setIsLoading(false);
    }
  }, [copy.loadError, workOrderId]);

  const loadMembers = useCallback(async () => {
    try {
      const membersData = await listTenantMembers();
      setMembers(membersData);
    } catch {
      setMembers([]);
    }
  }, []);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/auth/login');
    }
  }, [isAuthLoading, router, user]);

  useEffect(() => {
    if (!user) return;
    void Promise.all([loadDetails(), loadMembers()]);
  }, [loadDetails, loadMembers, user]);

  const handleSaveChanges = useCallback(async () => {
    if (!workOrder || !form || !workOrderId) return;

    const payload = buildUpdatePayload(workOrder, form);
    if (Object.keys(payload).length === 0) {
      showToast(copy.toast.updated, 'success');
      return;
    }

    setIsSaving(true);
    try {
      await updateWorkOrder(workOrderId, payload);
      await loadDetails();
      showToast(copy.toast.updated, 'success');
    } catch (saveError) {
      if (saveError instanceof WorkOrderClientError) {
        showToast(saveError.message, 'error');
      } else {
        showToast(copy.toast.genericError, 'error');
      }
    } finally {
      setIsSaving(false);
    }
  }, [copy.toast.genericError, copy.toast.updated, form, loadDetails, showToast, workOrder, workOrderId]);

  const handleToggleChecklist = useCallback(
    async (itemId: string, completed: boolean) => {
      if (!workOrderId) return;
      setUpdatingChecklistId(itemId);
      try {
        await toggleWorkOrderChecklistItem(workOrderId, itemId, completed);
        await loadDetails();
        showToast(copy.toast.checklistUpdated, 'success');
      } catch (toggleError) {
        if (toggleError instanceof WorkOrderClientError) {
          showToast(toggleError.message, 'error');
        } else {
          showToast(copy.toast.genericError, 'error');
        }
      } finally {
        setUpdatingChecklistId(null);
      }
    },
    [copy.toast.checklistUpdated, copy.toast.genericError, loadDetails, showToast, workOrderId]
  );

  const handleAddComment = useCallback(async () => {
    if (!workOrderId || !commentBody.trim()) return;

    setIsPostingComment(true);
    try {
      const createdComment = await addWorkOrderComment(workOrderId, commentBody.trim());
      setCommentBody('');
      setWorkOrder((current) =>
        current
          ? {
              ...current,
              comments: [...current.comments, createdComment],
              commentTotal: current.commentTotal + 1,
            }
          : current
      );
      showToast(copy.toast.commentAdded, 'success');
    } catch (commentError) {
      if (commentError instanceof WorkOrderClientError) {
        showToast(commentError.message, 'error');
      } else {
        showToast(copy.toast.genericError, 'error');
      }
    } finally {
      setIsPostingComment(false);
    }
  }, [commentBody, copy.toast.commentAdded, copy.toast.genericError, showToast, workOrderId]);

  const handleAppendChecklistItems = useCallback(async () => {
    if (!workOrder || !workOrderId || !appendChecklistText.trim()) return;

    const items = appendChecklistText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((title) => ({ title, required: true }));

    if (items.length === 0) return;

    setIsAppendingChecklist(true);
    try {
      await updateWorkOrder(workOrderId, { appendChecklistItems: items });
      setAppendChecklistText('');
      await loadDetails();
      showToast(copy.toast.updated, 'success');
    } catch (appendError) {
      if (appendError instanceof WorkOrderClientError) {
        showToast(appendError.message, 'error');
      } else {
        showToast(copy.toast.genericError, 'error');
      }
    } finally {
      setIsAppendingChecklist(false);
    }
  }, [appendChecklistText, copy.toast.genericError, copy.toast.updated, loadDetails, showToast, workOrder, workOrderId]);

  if (isAuthLoading || !user) {
    return null;
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Navbar title={copy.pageTitle} showSearch={false} />

      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8 space-y-6">
        <Link
          href="/work-orders"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft size={16} />
          {copy.detail.back}
        </Link>

        {isLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-24 rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-40 rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-56 rounded-2xl bg-slate-200 dark:bg-slate-800" />
          </div>
        ) : error || !workOrder || !form ? (
          <Card className="p-8 text-center">
            <p className="text-lg font-semibold text-slate-900 dark:text-white">{copy.detail.notFound}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{error || copy.loadError}</p>
          </Card>
        ) : (
          <>
            <Card spotlight className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{workOrder.title}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <WorkOrderStatusPill
                      status={workOrder.status}
                      label={copy.statusLabels[workOrder.status]}
                    />
                    <WorkOrderPriorityPill
                      priority={workOrder.priority}
                      label={copy.priorityLabels[workOrder.priority]}
                    />
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Clock3 size={13} />
                      {formatDisplayDate(workOrder.dueAt, locale)}
                    </span>
                  </div>
                </div>

                <Button variant="primary" onClick={() => void handleSaveChanges()} isLoading={isSaving}>
                  {copy.detail.saveChanges}
                </Button>
              </div>
            </Card>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Card className="p-5 xl:col-span-2 space-y-4">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">{copy.detail.metadata}</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      {copy.detail.updateStatus}
                    </label>
                    <select
                      value={form.status}
                      onChange={(event) =>
                        setForm((current) =>
                          current ? { ...current, status: event.target.value as WorkOrderStatus } : current
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    >
                      {WORK_ORDER_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {copy.statusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      {copy.form.priority}
                    </label>
                    <select
                      value={form.priority}
                      onChange={(event) =>
                        setForm((current) =>
                          current ? { ...current, priority: event.target.value as WorkOrderPriority } : current
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    >
                      {WORK_ORDER_PRIORITIES.map((priority) => (
                        <option key={priority} value={priority}>
                          {copy.priorityLabels[priority]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Input
                    label={copy.form.dueAt}
                    type="datetime-local"
                    value={form.dueAt}
                    onChange={(event) =>
                      setForm((current) => (current ? { ...current, dueAt: event.target.value } : current))
                    }
                  />

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      {copy.detail.assignTo}
                    </label>
                    <select
                      value={form.assignedToUserId}
                      onChange={(event) =>
                        setForm((current) =>
                          current ? { ...current, assignedToUserId: event.target.value } : current
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    >
                      <option value="">{copy.detail.unassigned}</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} ({member.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <Input
                    label={copy.form.estimatedMinutes}
                    type="number"
                    min={1}
                    value={form.estimatedMinutes}
                    onChange={(event) =>
                      setForm((current) =>
                        current ? { ...current, estimatedMinutes: event.target.value } : current
                      )
                    }
                  />
                  <Input
                    label={copy.form.actualMinutes}
                    type="number"
                    min={0}
                    value={form.actualMinutes}
                    onChange={(event) =>
                      setForm((current) =>
                        current ? { ...current, actualMinutes: event.target.value } : current
                      )
                    }
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      {copy.form.location}
                    </label>
                    <div className="relative">
                      <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={form.location}
                        onChange={(event) =>
                          setForm((current) =>
                            current ? { ...current, location: event.target.value } : current
                          )
                        }
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      {copy.form.assetTag}
                    </label>
                    <div className="relative">
                      <PackageSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={form.assetTag}
                        onChange={(event) =>
                          setForm((current) =>
                            current ? { ...current, assetTag: event.target.value } : current
                          )
                        }
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    {copy.detail.description}
                  </label>
                  <textarea
                    rows={5}
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) =>
                        current ? { ...current, description: event.target.value } : current
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
              </Card>

              <Card className="p-5 space-y-3">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">{copy.detail.checklist}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {workOrder.checklistCompleted} / {workOrder.checklistTotal}
                </p>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {workOrder.checklist.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">-</p>
                  ) : (
                    workOrder.checklist.map((item) => (
                      <label
                        key={item.id}
                        className="flex items-start gap-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-900/40 px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          checked={item.completed}
                          disabled={updatingChecklistId === item.id}
                          onChange={(event) =>
                            void handleToggleChecklist(item.id, event.target.checked)
                          }
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500/30"
                        />
                        <span
                          className={`text-sm ${
                            item.completed
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {item.title}
                        </span>
                      </label>
                    ))
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                  <textarea
                    rows={3}
                    value={appendChecklistText}
                    onChange={(event) => setAppendChecklistText(event.target.value)}
                    placeholder={copy.form.checklistHint}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleAppendChecklistItems()}
                    isLoading={isAppendingChecklist}
                    leftIcon={<Plus size={14} />}
                  >
                    {copy.form.checklist}
                  </Button>
                </div>
              </Card>
            </section>

            <Card className="p-5 space-y-4">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">{copy.detail.comments}</h2>

              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {workOrder.comments.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{copy.detail.noComments}</p>
                ) : (
                  workOrder.comments.map((comment) => (
                    <article
                      key={comment.id}
                      className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/40 p-3"
                    >
                      <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                        {comment.body}
                      </p>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {comment.authorName || '-'} • {formatDisplayDate(comment.createdAt, locale)}
                      </p>
                    </article>
                  ))
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <textarea
                  rows={2}
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  placeholder={copy.detail.commentPlaceholder}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleAddComment()}
                  isLoading={isPostingComment}
                  leftIcon={<Send size={14} />}
                >
                  {copy.detail.addComment}
                </Button>
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
