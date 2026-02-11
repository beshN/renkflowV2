'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Search, RotateCw, ClipboardPlus } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/client';
import { useToast } from '@/lib/context/ToastContext';
import { useAuth } from '@/lib/context/AuthContext';
import {
  getWorkOrderSummary,
  listTenantMembers,
  listWorkOrders,
  updateWorkOrder,
  WorkOrder,
  WorkOrderClientError,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderSummary,
  TenantMember,
} from '@/lib/features/work-orders/client';
import { getWorkOrdersCopy } from '@/lib/features/work-orders/ui-copy';
import { CreateWorkOrderDialog } from '@/components/features/work-orders/CreateWorkOrderDialog';
import { WorkOrderSummaryCards } from '@/components/features/work-orders/WorkOrderSummaryCards';
import { WorkOrderListPanel } from '@/components/features/work-orders/WorkOrderListPanel';

type PaginationState = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const defaultPagination: PaginationState = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0,
};

export default function WorkOrdersPage() {
  const router = useRouter();
  const { locale } = useTranslation();
  const copy = useMemo(() => getWorkOrdersCopy(locale), [locale]);
  const { showToast } = useToast();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<WorkOrderPriority | 'all'>('all');
  const [includeClosed, setIncludeClosed] = useState(true);

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [summary, setSummary] = useState<WorkOrderSummary | null>(null);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [pagination, setPagination] = useState<PaginationState>(defaultPagination);

  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingWorkOrderId, setUpdatingWorkOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const loadSummary = useCallback(async () => {
    setIsLoadingSummary(true);
    try {
      const summaryData = await getWorkOrderSummary();
      setSummary(summaryData);
    } catch (loadError) {
      if (loadError instanceof WorkOrderClientError) {
        setError(loadError.message);
      } else {
        setError(copy.loadError);
      }
    } finally {
      setIsLoadingSummary(false);
    }
  }, [copy.loadError]);

  const loadMembers = useCallback(async () => {
    try {
      const membersData = await listTenantMembers();
      setMembers(membersData);
    } catch {
      setMembers([]);
    }
  }, []);

  const loadList = useCallback(async () => {
    setIsLoadingList(true);
    setError(null);

    try {
      const response = await listWorkOrders({
        page: pagination.page,
        pageSize: pagination.pageSize,
        status: statusFilter === 'all' ? undefined : statusFilter,
        priority: priorityFilter === 'all' ? undefined : priorityFilter,
        search: debouncedSearch || undefined,
        includeClosed,
      });

      setWorkOrders(response.data);
      setPagination((current) => ({
        ...current,
        total: response.pagination.total,
        totalPages: response.pagination.totalPages,
      }));
    } catch (loadError) {
      if (loadError instanceof WorkOrderClientError) {
        setError(loadError.message);
      } else {
        setError(copy.loadError);
      }
    } finally {
      setIsLoadingList(false);
    }
  }, [copy.loadError, debouncedSearch, includeClosed, pagination.page, pagination.pageSize, priorityFilter, statusFilter]);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/auth/login');
    }
  }, [isAuthLoading, router, user]);

  useEffect(() => {
    if (!user) return;
    void loadSummary();
    void loadMembers();
  }, [loadMembers, loadSummary, user]);

  useEffect(() => {
    if (!user) return;
    void loadList();
  }, [loadList, user]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadSummary(), loadList(), loadMembers()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadList, loadMembers, loadSummary]);

  const handleOpenDetails = useCallback(
    (workOrderId: string) => {
      router.push(`/work-orders/${workOrderId}`);
    },
    [router]
  );

  const handleQuickStatusChange = useCallback(
    async (workOrderId: string, status: WorkOrderStatus) => {
      setUpdatingWorkOrderId(workOrderId);
      try {
        const updated = await updateWorkOrder(workOrderId, { status });
        setWorkOrders((current) =>
          current.map((item) => (item.id === workOrderId ? { ...item, ...updated } : item))
        );
        await loadSummary();
        showToast(copy.toast.updated, 'success');
      } catch (updateError) {
        if (updateError instanceof WorkOrderClientError) {
          showToast(updateError.message, 'error');
        } else {
          showToast(copy.toast.genericError, 'error');
        }
      } finally {
        setUpdatingWorkOrderId(null);
      }
    },
    [copy.toast.genericError, copy.toast.updated, loadSummary, showToast]
  );

  const handleCreated = useCallback(
    async () => {
      showToast(copy.toast.created, 'success');
      setPagination((current) => ({ ...current, page: 1 }));
      if (pagination.page === 1) {
        await loadList();
      }
      await loadSummary();
    },
    [copy.toast.created, loadList, loadSummary, pagination.page, showToast]
  );

  const isFirstLoad = isLoadingList && pagination.total === 0 && workOrders.length === 0;

  if (isAuthLoading || !user) {
    return null;
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Navbar title={copy.pageTitle} showSearch={false} />

      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8 space-y-6">
        <Card spotlight className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{copy.pageTitle}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{copy.subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleRefresh()}
                isLoading={isRefreshing}
                leftIcon={<RotateCw size={15} />}
              >
                {copy.refreshButton}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                leftIcon={<ClipboardPlus size={15} />}
              >
                {copy.createButton}
              </Button>
            </div>
          </div>
        </Card>

        {isLoadingSummary ? (
          <div className="animate-pulse grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800" />
          </div>
        ) : (
          <WorkOrderSummaryCards summary={summary} copy={copy} locale={locale} />
        )}

        <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-4 md:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="xl:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
                placeholder={copy.searchPlaceholder}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2.5 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as WorkOrderStatus | 'all');
                setPagination((current) => ({ ...current, page: 1 }));
              }}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            >
              <option value="all">{copy.allStatuses}</option>
              {WORK_ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {copy.statusLabels[status]}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(event) => {
                setPriorityFilter(event.target.value as WorkOrderPriority | 'all');
                setPagination((current) => ({ ...current, page: 1 }));
              }}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            >
              <option value="all">{copy.allPriorities}</option>
              {WORK_ORDER_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {copy.priorityLabels[priority]}
                </option>
              ))}
            </select>
          </div>

          <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={includeClosed}
              onChange={(event) => {
                setIncludeClosed(event.target.checked);
                setPagination((current) => ({ ...current, page: 1 }));
              }}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500/30"
            />
            {includeClosed ? copy.includeClosed : copy.onlyOpen}
          </label>
        </section>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <WorkOrderListPanel
          workOrders={workOrders}
          locale={locale}
          copy={copy}
          isLoading={isFirstLoad || isLoadingList}
          updatingWorkOrderId={updatingWorkOrderId}
          onOpenDetails={handleOpenDetails}
          onQuickStatusChange={(workOrderId, status) => void handleQuickStatusChange(workOrderId, status)}
        />

        {pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {pagination.page} / {pagination.totalPages} • {pagination.total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() =>
                  setPagination((current) => ({ ...current, page: Math.max(1, current.page - 1) }))
                }
              >
                {copy.previousPage}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() =>
                  setPagination((current) => ({
                    ...current,
                    page: Math.min(current.totalPages || 1, current.page + 1),
                  }))
                }
              >
                {copy.nextPage}
              </Button>
            </div>
          </div>
        ) : null}
      </main>

      <CreateWorkOrderDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        members={members}
        copy={copy}
        onCreated={() => void handleCreated()}
      />
    </div>
  );
}
