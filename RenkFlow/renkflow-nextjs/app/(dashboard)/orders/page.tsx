'use client';

/**
 * Enterprise Orders Page
 * Full-featured data management platform
 */

import { useEffect, useMemo, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { useOrders } from '@/lib/hooks/useOrders';
import { useToast } from '@/lib/context/ToastContext';
import { useOrdersStore, ViewMode } from '@/lib/stores/orders.store';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { exportOrders, ExportFormat } from '@/lib/utils/export';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorState, SectionSkeleton, SkeletonCard } from '@/components/ui/skeleton';
import { useExportJobs } from '@/lib/hooks/useExportJobs';
import {
  TableProperties,
  KanbanSquare,
  Calendar,
  Activity,
  Plus
} from 'lucide-react';

// Enterprise Components
import {
  DataGrid,
  FilterSidebar,
  BulkActionsToolbar,
  CommandPalette,
  KanbanBoardV2,
  CalendarView,
  ExportJobsDialog,
} from '@/components/orders/enterprise';
import { Order, OrderStatus } from '@/lib/types';

export default function OrdersPage() {
  const router = useRouter();
  const { deleteOrder, updateOrderStatus, updateOrder, refresh, error } = useOrders();
  const { showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isExportCenterOpen, setIsExportCenterOpen] = useState(false);

  const exportJobs = useExportJobs({ pollIntervalMs: 5000, listLimit: 20 });

  // Zustand store
  const {
    viewMode,
    setViewMode,
    orders,
    isLoading,
    setTotalCount,
    filters,
    setSearch,
    isSidebarOpen,
    selectedIds,
    selectAllMode,
    selectAll,
    clearSelection,
    getFilteredOrders,
    getSelectedOrders,
    isConnected,
    setConnected,
    setOffline,
    lastSyncAt,
    setLastSyncAt,
    autoRefreshInterval,
    setAutoRefreshInterval,
    dirtyRows,
    clearDirtyRow,
    discardDirtyRows,
    setCalendarView,
  } = useOrdersStore();

  useEffect(() => {
    setTotalCount(orders.length);
  }, [orders.length, setTotalCount]);

  // Online/offline detection for connection status
  useEffect(() => {
    const updateConnection = () => {
      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
      setConnected(online);
      setOffline(!online);
    };

    updateConnection();
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);

    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, [setConnected, setOffline]);

  // Auto-refresh polling
  useEffect(() => {
    if (!autoRefreshInterval) return;

    const intervalId = setInterval(async () => {
      await refresh();
      setLastSyncAt(new Date());
    }, autoRefreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefreshInterval, refresh, setLastSyncAt]);

  // Update last sync on successful load
  useEffect(() => {
    if (!isLoading) {
      setLastSyncAt(new Date());
    }
  }, [isLoading, orders, setLastSyncAt]);

  // Get filtered orders
  const filteredOrders = useMemo(() => getFilteredOrders(), [getFilteredOrders, orders, filters]);
  const filteredIds = useMemo(() => filteredOrders.map((order) => order.id), [filteredOrders]);

  // Keep select-all in sync with current filters
  useEffect(() => {
    if (selectAllMode === 'all') {
      selectAll('all', filteredIds);
    }
  }, [selectAllMode, filteredIds, selectAll]);

  // Extract unique customers and products for filter autocomplete
  const uniqueCustomers = useMemo(
    () => [...new Set(orders.map((o) => o.customerName).filter(Boolean))] as string[],
    [orders]
  );
  const uniqueProducts = useMemo(
    () => [...new Set(orders.map((o) => o.productName).filter(Boolean))] as string[],
    [orders]
  );

  // Handle export
  const handleExport = useCallback(
    (format: ExportFormat) => {
      const ordersToExport = selectedIds.size > 0 ? getSelectedOrders() : filteredOrders;
      exportOrders(ordersToExport, format);
      showToast(`${ordersToExport.length} sipariş ${format.toUpperCase()} olarak dışa aktarıldı`, 'success');
    },
    [selectedIds, getSelectedOrders, filteredOrders, showToast]
  );

  const handleServerExport = useCallback(async () => {
    setIsExportCenterOpen(true);
    const job = await exportJobs.createJob({
      format: 'csv',
      entityType: 'orders',
    });
    if (job) {
      showToast('Export işi başlatıldı', 'success');
    } else if (exportJobs.error) {
      showToast(exportJobs.error, 'error');
    }
  }, [exportJobs, showToast]);

  // Handle status change
  const handleStatusChange = useCallback(
    async (orderId: string, status: OrderStatus) => {
      try {
        await updateOrderStatus(orderId, status);
        showToast('Sipariş durumu güncellendi', 'success');
      } catch (error) {
        showToast('Durum güncellenirken hata oluştu', 'error');
      }
    },
    [updateOrderStatus, showToast]
  );

  // Handle order click
  const handleOrderClick = useCallback(
    (order: { id: string }) => {
      router.push(`/orders/${order.id}`);
    },
    [router]
  );

  // Bulk delete
  const handleBulkDelete = useCallback(
    async (ids?: string[]) => {
      const targetIds = ids && ids.length > 0 ? ids : Array.from(selectedIds);
      if (targetIds.length === 0) return;

      try {
        for (const id of targetIds) {
          await deleteOrder(id);
        }
        clearSelection();
        showToast(`${targetIds.length} sipariş silindi`, 'success');
      } catch (error) {
        showToast('Siparişler silinirken hata oluştu', 'error');
      }
    },
    [selectedIds, deleteOrder, showToast]
  );

  // Bulk status change
  const handleBulkStatusChange = useCallback(
    async (ids: string[], status: OrderStatus) => {
      if (ids.length === 0) return;

      try {
        for (const id of ids) {
          await updateOrderStatus(id, status);
        }
        showToast('Sipariş durumu güncellendi', 'success');
      } catch (error) {
        showToast('Toplu güncelleme sırasında hata oluştu', 'error');
      }
    },
    [updateOrderStatus, showToast]
  );

  // Save dirty rows (inline edits)
  const handleSaveDirtyRows = useCallback(async () => {
    if (dirtyRows.size === 0 || isSaving) return;
    setIsSaving(true);

    try {
      const dirtyEntries = Array.from(dirtyRows.values());
      for (const dirty of dirtyEntries) {
        const updates: Partial<Order> = {};
        Object.entries(dirty.changes).forEach(([key, change]) => {
          (updates as Record<string, unknown>)[key] = change.current;
        });
        await updateOrder(dirty.rowId, updates);
        clearDirtyRow(dirty.rowId);
      }
      showToast('Değişiklikler kaydedildi', 'success');
    } catch (error) {
      showToast('Değişiklikler kaydedilemedi', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [dirtyRows, isSaving, updateOrder, clearDirtyRow, showToast]);

  // View mode components
  const viewModeConfig: { mode: ViewMode; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
    { mode: 'grid', icon: TableProperties, label: 'Tablo' },
    { mode: 'kanban', icon: KanbanSquare, label: 'Kanban' },
    { mode: 'calendar', icon: Calendar, label: 'Takvim' },
    { mode: 'timeline', icon: Activity, label: 'Timeline' },
  ];

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      if (mode === 'timeline') {
        setCalendarView('timeline');
      }
      if (mode === 'calendar') {
        setCalendarView('month');
      }
    },
    [setViewMode, setCalendarView]
  );

  // Auto-refresh options
  const refreshOptions = [
    { value: null, label: 'Manuel' },
    { value: 30000, label: '30 sn' },
    { value: 60000, label: '1 dk' },
    { value: 300000, label: '5 dk' },
  ];

  // Global keyboard shortcuts
  useKeyboardShortcuts({
    onBulkDelete: handleBulkDelete,
    onExport: () => handleExport('csv'),
  });

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-transparent">
      {/* Command Palette */}
      <CommandPalette />

      {/* Navbar */}
      <Navbar
        title="Siparişler"
        showSearch={true}
        onSearch={setSearch}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden pt-16 md:pt-0">
        {/* Filter Sidebar */}
        <AnimatePresence>
          {isSidebarOpen && (
            <FilterSidebar
              customers={uniqueCustomers}
              products={uniqueProducts}
            />
          )}
        </AnimatePresence>

        {/* Main Area */}
        <main role="main" className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 px-6 py-4 border-b border-gray-200/50 dark:border-gray-800/50 glass sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Siparişler
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400" aria-live="polite">
                  {filteredOrders.length} / {orders.length} sipariş
                  {filters.search && ` • "${filters.search}" için sonuçlar`}
                </p>
              </div>

              {/* Connection Status */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full" aria-live="polite">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    isConnected ? 'bg-green-500' : 'bg-gray-400'
                  )}
                />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {isConnected ? 'Bağlı' : 'Çevrimdışı'}
                </span>
              </div>

              {/* Last Sync */}
              {lastSyncAt && (
                <span className="text-xs text-gray-500">
                  Son güncelleme: {new Date(lastSyncAt).toLocaleTimeString('tr-TR')}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Dirty State Warning */}
              {dirtyRows.size > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                  <span className="text-sm text-yellow-700 dark:text-yellow-300">
                    {dirtyRows.size} kaydedilmemiş değişiklik
                  </span>
                  <button
                    onClick={handleSaveDirtyRows}
                    disabled={isSaving}
                    className="text-xs px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-60"
                  >
                    Kaydet
                  </button>
                  <button
                    onClick={() => discardDirtyRows()}
                    className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    İptal
                  </button>
                </div>
              )}

              {/* Auto Refresh */}
              <select
                value={autoRefreshInterval ?? ''}
                onChange={(e) => setAutoRefreshInterval(e.target.value ? parseInt(e.target.value) : null)}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                aria-label="Otomatik yenileme aralığı"
              >
                {refreshOptions.map((opt) => (
                  <option key={opt.label} value={opt.value ?? ''}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* View Mode Toggle */}
              <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                {viewModeConfig.map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => handleViewModeChange(mode)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
                      viewMode === mode
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    )}
                    title={label}
                    aria-pressed={viewMode === mode}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden lg:inline">{label}</span>
                  </button>
                ))}
              </div>

              {/* New Order Button */}
              <button
                onClick={() => router.push('/new-order')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Yeni Sipariş</span>
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto p-6">
            <AnimatePresence mode="wait">
              {error ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center h-full"
                >
                  <ErrorState
                    title="Siparişler yüklenemedi"
                    description={error.message || 'Bağlantınızı kontrol edip tekrar deneyin.'}
                    onRetry={refresh}
                  />
                </motion.div>
              ) : isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full"
                >
                  <div className="xl:col-span-2 space-y-6">
                    <SectionSkeleton rows={6} />
                    <SectionSkeleton rows={6} />
                  </div>
                  <div className="space-y-4">
                    <SkeletonCard />
                    <SkeletonCard />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={viewMode}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="h-full"
                >
                  {viewMode === 'grid' && (
                    <DataGrid
                      data={filteredOrders}
                      onRowClick={handleOrderClick}
                    />
                  )}
                  {viewMode === 'kanban' && (
                    <KanbanBoardV2
                      orders={filteredOrders}
                      onOrderClick={handleOrderClick}
                      onStatusChange={handleStatusChange}
                    />
                  )}
                  {viewMode === 'calendar' && (
                    <CalendarView
                      orders={filteredOrders}
                      onOrderClick={handleOrderClick}
                    />
                  )}
                  {viewMode === 'timeline' && (
                    <CalendarView
                      orders={filteredOrders}
                      onOrderClick={handleOrderClick}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Bulk Actions Toolbar */}
      <AnimatePresence>
        {(selectedIds.size > 0 || selectAllMode === 'all') && (
          <BulkActionsToolbar
            totalFilteredCount={filteredOrders.length}
            filteredIds={filteredIds}
            onExport={handleExport}
            onServerExport={handleServerExport}
            onBulkUpdateStatus={handleBulkStatusChange}
            onBulkDelete={handleBulkDelete}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isExportCenterOpen && (
          <ExportJobsDialog
            isOpen={isExportCenterOpen}
            jobs={exportJobs.jobs}
            isLoading={exportJobs.isLoading}
            error={exportJobs.error}
            onClose={() => setIsExportCenterOpen(false)}
            onRefresh={exportJobs.refresh}
            onCreate={(format) => {
              exportJobs.createJob({ format, entityType: 'orders' });
            }}
            onDownload={exportJobs.downloadJob}
          />
        )}
      </AnimatePresence>

      {/* Keyboard Shortcuts Hint */}
      <div className="fixed bottom-4 right-4 hidden lg:flex items-center gap-2 px-3 py-2 bg-gray-900/80 text-white text-xs rounded-lg backdrop-blur-sm">
        <kbd className="px-1.5 py-0.5 bg-gray-700 rounded">⌘K</kbd>
        <span>Komut Paleti</span>
      </div>
    </div>
  );
}
