/**
 * Enterprise Orders Store - Zustand
 * Complex state management for orders module
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { Order, OrderStatus } from '@/lib/types';

// ============================================
// Types
// ============================================

export type ViewMode = 'grid' | 'kanban' | 'calendar' | 'timeline';
export type SortDirection = 'asc' | 'desc';
export type DatePreset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  frozen: boolean;
  width: number;
  order: number;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: OrderFilters;
  createdAt: Date;
}

export interface OrderFilters {
  search: string;
  status: OrderStatus[];
  dateRange: {
    preset: DatePreset;
    from: Date | null;
    to: Date | null;
  };
  amountRange: {
    min: number | null;
    max: number | null;
  };
  customers: string[];
  products: string[];
  tags: string[];
}

export interface SortConfig {
  column: string;
  direction: SortDirection;
}

export interface EditingCell {
  rowId: string;
  columnId: string;
  originalValue: unknown;
  currentValue: unknown;
}

export interface DirtyRow {
  rowId: string;
  changes: Record<string, { original: unknown; current: unknown }>;
}

export interface SyncQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  data: Partial<Order>;
  timestamp: number;
  retries: number;
}

export interface OrdersState {
  // Data
  orders: Order[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  
  // View
  viewMode: ViewMode;
  
  // Selection
  selectedIds: Set<string>;
  selectAllMode: 'page' | 'all' | null;
  
  // Filtering
  filters: OrderFilters;
  filterPresets: FilterPreset[];
  activePresetId: string | null;
  
  // Sorting
  sort: SortConfig;
  
  // Pagination
  page: number;
  pageSize: number;
  
  // Columns
  columns: ColumnConfig[];
  
  // Inline Editing
  editingCell: EditingCell | null;
  dirtyRows: Map<string, DirtyRow>;
  
  // Real-time
  isConnected: boolean;
  lastSyncAt: Date | null;
  autoRefreshInterval: number | null; // milliseconds, null = manual
  
  // Offline
  isOffline: boolean;
  syncQueue: SyncQueueItem[];
  
  // UI State
  isSidebarOpen: boolean;
  isCommandPaletteOpen: boolean;
  expandedRowIds: Set<string>;
  
  // Kanban specific
  kanbanGroupBy: 'status' | 'priority' | 'assignee';
  kanbanWipLimits: Record<string, number>;
  
  // Calendar specific
  calendarView: 'month' | 'week' | 'day' | 'timeline';
  calendarDate: Date;
}

export interface OrdersActions {
  // Data Actions
  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  removeOrder: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setTotalCount: (count: number) => void;
  
  // View Actions
  setViewMode: (mode: ViewMode) => void;
  
  // Selection Actions
  selectRow: (id: string) => void;
  deselectRow: (id: string) => void;
  selectMultiple: (ids: string[]) => void;
  selectAll: (mode: 'page' | 'all', ids?: string[]) => void;
  clearSelection: () => void;
  toggleRowSelection: (id: string) => void;
  
  // Filter Actions
  setFilters: (filters: Partial<OrderFilters>) => void;
  resetFilters: () => void;
  setDateRange: (preset: DatePreset, from?: Date, to?: Date) => void;
  addStatusFilter: (status: OrderStatus) => void;
  removeStatusFilter: (status: OrderStatus) => void;
  setAmountRange: (min: number | null, max: number | null) => void;
  setSearch: (search: string) => void;
  
  // Preset Actions
  saveFilterPreset: (name: string) => void;
  loadFilterPreset: (id: string) => void;
  deleteFilterPreset: (id: string) => void;
  
  // Sort Actions
  setSort: (column: string, direction?: SortDirection) => void;
  toggleSort: (column: string) => void;
  
  // Pagination Actions
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  
  // Column Actions
  setColumnWidth: (id: string, width: number) => void;
  setColumnVisible: (id: string, visible: boolean) => void;
  setColumnFrozen: (id: string, frozen: boolean) => void;
  reorderColumns: (fromIndex: number, toIndex: number) => void;
  resetColumns: () => void;
  
  // Inline Editing Actions
  startEditing: (rowId: string, columnId: string, value: unknown) => void;
  updateEditingValue: (value: unknown) => void;
  commitEdit: () => void;
  cancelEdit: () => void;
  markRowDirty: (rowId: string, columnId: string, original: unknown, current: unknown) => void;
  clearDirtyRow: (rowId: string) => void;
  saveDirtyRows: () => Promise<void>;
  discardDirtyRows: () => void;
  
  // Real-time Actions
  setConnected: (connected: boolean) => void;
  setLastSyncAt: (date: Date) => void;
  setAutoRefreshInterval: (interval: number | null) => void;
  
  // Offline Actions
  setOffline: (offline: boolean) => void;
  addToSyncQueue: (item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>) => void;
  removeFromSyncQueue: (id: string) => void;
  processSyncQueue: () => Promise<void>;
  
  // UI Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleRowExpanded: (id: string) => void;
  expandRow: (id: string) => void;
  collapseRow: (id: string) => void;
  
  // Kanban Actions
  setKanbanGroupBy: (groupBy: 'status' | 'priority' | 'assignee') => void;
  setKanbanWipLimit: (column: string, limit: number) => void;
  
  // Calendar Actions
  setCalendarView: (view: 'month' | 'week' | 'day' | 'timeline') => void;
  setCalendarDate: (date: Date) => void;
  
  // Bulk Actions
  bulkUpdateStatus: (ids: string[], status: OrderStatus) => Promise<void>;
  bulkDelete: (ids: string[]) => Promise<void>;
  bulkAddTags: (ids: string[], tags: string[]) => Promise<void>;
  
  // Computed
  getFilteredOrders: () => Order[];
  getSelectedOrders: () => Order[];
  getVisibleColumns: () => ColumnConfig[];
  getDirtyRowCount: () => number;
  getSyncQueueCount: () => number;
}

// ============================================
// Default Values
// ============================================

const defaultFilters: OrderFilters = {
  search: '',
  status: [],
  dateRange: {
    preset: 'this_month',
    from: null,
    to: null,
  },
  amountRange: {
    min: null,
    max: null,
  },
  customers: [],
  products: [],
  tags: [],
};

const defaultColumns: ColumnConfig[] = [
  { id: 'select', label: '', visible: true, frozen: true, width: 40, order: 0 },
  { id: 'orderNumber', label: 'Sipariş No', visible: true, frozen: true, width: 120, order: 1 },
  { id: 'customerName', label: 'Müşteri', visible: true, frozen: false, width: 180, order: 2 },
  { id: 'productName', label: 'Ürün', visible: true, frozen: false, width: 200, order: 3 },
  { id: 'quantity', label: 'Miktar', visible: true, frozen: false, width: 80, order: 4 },
  { id: 'totalAmount', label: 'Tutar', visible: true, frozen: false, width: 120, order: 5 },
  { id: 'status', label: 'Durum', visible: true, frozen: false, width: 130, order: 6 },
  { id: 'deliveryDate', label: 'Teslim Tarihi', visible: true, frozen: false, width: 130, order: 7 },
  { id: 'createdAt', label: 'Oluşturulma', visible: true, frozen: false, width: 130, order: 8 },
  { id: 'actions', label: 'İşlemler', visible: true, frozen: false, width: 100, order: 9 },
];

// ============================================
// Store
// ============================================

export const useOrdersStore = create<OrdersState & OrdersActions>()(
  devtools(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          // Initial State
          orders: [],
          totalCount: 0,
          isLoading: false,
          error: null,
          viewMode: 'grid',
          selectedIds: new Set(),
          selectAllMode: null,
          filters: defaultFilters,
          filterPresets: [],
          activePresetId: null,
          sort: { column: 'createdAt', direction: 'desc' },
          page: 1,
          pageSize: 50,
          columns: defaultColumns,
          editingCell: null,
          dirtyRows: new Map(),
          isConnected: false,
          lastSyncAt: null,
          autoRefreshInterval: null,
          isOffline: false,
          syncQueue: [],
          isSidebarOpen: true,
          isCommandPaletteOpen: false,
          expandedRowIds: new Set(),
          kanbanGroupBy: 'status',
          kanbanWipLimits: {
            pending: 15,
            in_production: 10,
            delivered: 20,
          },
          calendarView: 'month',
          calendarDate: new Date(),

          // Data Actions
          setOrders: (orders) => set({ orders, isLoading: false }),
          addOrder: (order) => set((state) => ({ 
            orders: [order, ...state.orders],
            totalCount: state.totalCount + 1,
          })),
          updateOrder: (id, updates) => set((state) => ({
            orders: state.orders.map((o) => 
              o.id === id ? { ...o, ...updates } : o
            ),
          })),
          removeOrder: (id) => set((state) => ({
            orders: state.orders.filter((o) => o.id !== id),
            totalCount: state.totalCount - 1,
            selectedIds: new Set([...state.selectedIds].filter((sid) => sid !== id)),
          })),
          setLoading: (isLoading) => set({ isLoading }),
          setError: (error) => set({ error, isLoading: false }),
          setTotalCount: (totalCount) => set({ totalCount }),

          // View Actions
          setViewMode: (viewMode) => set({ viewMode }),

          // Selection Actions
          selectRow: (id) => set((state) => {
            const newSet = new Set(state.selectedIds);
            newSet.add(id);
            return { selectedIds: newSet };
          }),
          deselectRow: (id) => set((state) => {
            const newSet = new Set(state.selectedIds);
            newSet.delete(id);
            return { selectedIds: newSet, selectAllMode: null };
          }),
          selectMultiple: (ids) => set((state) => {
            const newSet = new Set(state.selectedIds);
            ids.forEach((id) => newSet.add(id));
            return { selectedIds: newSet };
          }),
          selectAll: (mode, ids) => set((state) => {
            const targetIds = ids && ids.length > 0 ? ids : state.orders.map((o) => o.id);
            if (mode === 'page') {
              return {
                selectedIds: new Set(targetIds),
                selectAllMode: 'page',
              };
            }
            return {
              selectedIds: new Set(targetIds),
              selectAllMode: 'all',
            };
          }),
          clearSelection: () => set({ selectedIds: new Set(), selectAllMode: null }),
          toggleRowSelection: (id) => set((state) => {
            const newSet = new Set(state.selectedIds);
            if (newSet.has(id)) {
              newSet.delete(id);
            } else {
              newSet.add(id);
            }
            return { selectedIds: newSet, selectAllMode: null };
          }),

          // Filter Actions
          setFilters: (filters) => set((state) => ({
            filters: { ...state.filters, ...filters },
            page: 1,
          })),
          resetFilters: () => set({ filters: defaultFilters, page: 1, activePresetId: null }),
          setDateRange: (preset, from, to) => set((state) => ({
            filters: {
              ...state.filters,
              dateRange: { preset, from: from || null, to: to || null },
            },
            page: 1,
          })),
          addStatusFilter: (status) => set((state) => ({
            filters: {
              ...state.filters,
              status: [...state.filters.status, status],
            },
            page: 1,
          })),
          removeStatusFilter: (status) => set((state) => ({
            filters: {
              ...state.filters,
              status: state.filters.status.filter((s) => s !== status),
            },
            page: 1,
          })),
          setAmountRange: (min, max) => set((state) => ({
            filters: {
              ...state.filters,
              amountRange: { min, max },
            },
            page: 1,
          })),
          setSearch: (search) => set((state) => ({
            filters: { ...state.filters, search },
            page: 1,
          })),

          // Preset Actions
          saveFilterPreset: (name) => set((state) => {
            const preset: FilterPreset = {
              id: `preset_${Date.now()}`,
              name,
              filters: { ...state.filters },
              createdAt: new Date(),
            };
            return {
              filterPresets: [...state.filterPresets, preset],
              activePresetId: preset.id,
            };
          }),
          loadFilterPreset: (id) => set((state) => {
            const preset = state.filterPresets.find((p) => p.id === id);
            if (preset) {
              return { filters: { ...preset.filters }, activePresetId: id, page: 1 };
            }
            return {};
          }),
          deleteFilterPreset: (id) => set((state) => ({
            filterPresets: state.filterPresets.filter((p) => p.id !== id),
            activePresetId: state.activePresetId === id ? null : state.activePresetId,
          })),

          // Sort Actions
          setSort: (column, direction = 'asc') => set({ sort: { column, direction } }),
          toggleSort: (column) => set((state) => {
            if (state.sort.column === column) {
              return {
                sort: {
                  column,
                  direction: state.sort.direction === 'asc' ? 'desc' : 'asc',
                },
              };
            }
            return { sort: { column, direction: 'asc' } };
          }),

          // Pagination Actions
          setPage: (page) => set({ page }),
          setPageSize: (pageSize) => set({ pageSize, page: 1 }),
          nextPage: () => set((state) => {
            const maxPage = Math.ceil(state.totalCount / state.pageSize);
            return { page: Math.min(state.page + 1, maxPage) };
          }),
          prevPage: () => set((state) => ({ page: Math.max(state.page - 1, 1) })),

          // Column Actions
          setColumnWidth: (id, width) => set((state) => ({
            columns: state.columns.map((c) => 
              c.id === id ? { ...c, width } : c
            ),
          })),
          setColumnVisible: (id, visible) => set((state) => ({
            columns: state.columns.map((c) => 
              c.id === id ? { ...c, visible } : c
            ),
          })),
          setColumnFrozen: (id, frozen) => set((state) => ({
            columns: state.columns.map((c) => 
              c.id === id ? { ...c, frozen } : c
            ),
          })),
          reorderColumns: (fromIndex, toIndex) => set((state) => {
            const newColumns = [...state.columns];
            const [moved] = newColumns.splice(fromIndex, 1);
            newColumns.splice(toIndex, 0, moved);
            return {
              columns: newColumns.map((c, i) => ({ ...c, order: i })),
            };
          }),
          resetColumns: () => set({ columns: defaultColumns }),

          // Inline Editing Actions
          startEditing: (rowId, columnId, value) => set({
            editingCell: { rowId, columnId, originalValue: value, currentValue: value },
          }),
          updateEditingValue: (value) => set((state) => ({
            editingCell: state.editingCell 
              ? { ...state.editingCell, currentValue: value }
              : null,
          })),
          commitEdit: () => {
            const state = get();
            if (!state.editingCell) return;
            
            const { rowId, columnId, originalValue, currentValue } = state.editingCell;
            
            if (originalValue !== currentValue) {
              get().markRowDirty(rowId, columnId, originalValue, currentValue);
              get().updateOrder(rowId, { [columnId]: currentValue });
            }
            
            set({ editingCell: null });
          },
          cancelEdit: () => set({ editingCell: null }),
          markRowDirty: (rowId, columnId, original, current) => set((state) => {
            const newDirtyRows = new Map(state.dirtyRows);
            const existing = newDirtyRows.get(rowId) || { rowId, changes: {} };
            existing.changes[columnId] = { original, current };
            newDirtyRows.set(rowId, existing);
            return { dirtyRows: newDirtyRows };
          }),
          clearDirtyRow: (rowId) => set((state) => {
            const newDirtyRows = new Map(state.dirtyRows);
            newDirtyRows.delete(rowId);
            return { dirtyRows: newDirtyRows };
          }),
          saveDirtyRows: async () => {
            const state = get();
            // Implementation would call API for each dirty row
            // For now, just clear dirty state
            set({ dirtyRows: new Map() });
          },
          discardDirtyRows: () => {
            const state = get();
            // Revert all changes
            state.dirtyRows.forEach((dirty) => {
              const order = state.orders.find((o) => o.id === dirty.rowId);
              if (order) {
                const reverted = { ...order };
                Object.entries(dirty.changes).forEach(([col, change]) => {
                  (reverted as any)[col] = change.original;
                });
                get().updateOrder(dirty.rowId, reverted);
              }
            });
            set({ dirtyRows: new Map() });
          },

          // Real-time Actions
          setConnected: (isConnected) => set({ isConnected }),
          setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
          setAutoRefreshInterval: (autoRefreshInterval) => set({ autoRefreshInterval }),

          // Offline Actions
          setOffline: (isOffline) => set({ isOffline }),
          addToSyncQueue: (item) => set((state) => ({
            syncQueue: [
              ...state.syncQueue,
              {
                ...item,
                id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: Date.now(),
                retries: 0,
              },
            ],
          })),
          removeFromSyncQueue: (id) => set((state) => ({
            syncQueue: state.syncQueue.filter((item) => item.id !== id),
          })),
          processSyncQueue: async () => {
            // Process sync queue when back online
            const state = get();
            if (state.isOffline || state.syncQueue.length === 0) return;
            
            // Would implement actual sync logic here
            set({ syncQueue: [] });
          },

          // UI Actions
          toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
          setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
          toggleCommandPalette: () => set((state) => ({ 
            isCommandPaletteOpen: !state.isCommandPaletteOpen 
          })),
          setCommandPaletteOpen: (isCommandPaletteOpen) => set({ isCommandPaletteOpen }),
          toggleRowExpanded: (id) => set((state) => {
            const newSet = new Set(state.expandedRowIds);
            if (newSet.has(id)) {
              newSet.delete(id);
            } else {
              newSet.add(id);
            }
            return { expandedRowIds: newSet };
          }),
          expandRow: (id) => set((state) => {
            const newSet = new Set(state.expandedRowIds);
            newSet.add(id);
            return { expandedRowIds: newSet };
          }),
          collapseRow: (id) => set((state) => {
            const newSet = new Set(state.expandedRowIds);
            newSet.delete(id);
            return { expandedRowIds: newSet };
          }),

          // Kanban Actions
          setKanbanGroupBy: (kanbanGroupBy) => set({ kanbanGroupBy }),
          setKanbanWipLimit: (column, limit) => set((state) => ({
            kanbanWipLimits: { ...state.kanbanWipLimits, [column]: limit },
          })),

          // Calendar Actions
          setCalendarView: (calendarView) => set({ calendarView }),
          setCalendarDate: (calendarDate) => set({ calendarDate }),

          // Bulk Actions
          bulkUpdateStatus: async (ids, status) => {
            set((state) => ({
              orders: state.orders.map((o) => 
                ids.includes(o.id) ? { ...o, status } : o
              ),
            }));
            // Would call API here
          },
          bulkDelete: async (ids) => {
            set((state) => ({
              orders: state.orders.filter((o) => !ids.includes(o.id)),
              totalCount: state.totalCount - ids.length,
              selectedIds: new Set(),
            }));
            // Would call API here
          },
          bulkAddTags: async (ids, tags) => {
            // Would update orders with tags
          },

          // Computed Getters
          getFilteredOrders: () => {
            const state = get();
            let filtered = [...state.orders];
            
            // Apply search filter
            if (state.filters.search) {
              const search = state.filters.search.toLowerCase();
              filtered = filtered.filter((o) =>
                o.customerName?.toLowerCase().includes(search) ||
                o.productName?.toLowerCase().includes(search) ||
                o.orderNumber?.toLowerCase().includes(search) ||
                o.email?.toLowerCase().includes(search) ||
                o.id.toLowerCase().includes(search)
              );
            }
            
            // Apply status filter
            if (state.filters.status.length > 0) {
              filtered = filtered.filter((o) => 
                state.filters.status.includes(o.status)
              );
            }

            // Apply customer filter
            if (state.filters.customers.length > 0) {
              filtered = filtered.filter((o) => 
                o.customerName && state.filters.customers.includes(o.customerName)
              );
            }

            // Apply product filter
            if (state.filters.products.length > 0) {
              filtered = filtered.filter((o) => 
                o.productName && state.filters.products.includes(o.productName)
              );
            }

            // Apply date range
            if (state.filters.dateRange.from || state.filters.dateRange.to) {
              const from = state.filters.dateRange.from ? new Date(state.filters.dateRange.from) : null;
              const to = state.filters.dateRange.to ? new Date(state.filters.dateRange.to) : null;
              filtered = filtered.filter((o) => {
                const rawDate = o.date || o.createdAt;
                if (!rawDate) return false;
                const orderDate = new Date(rawDate);
                if (Number.isNaN(orderDate.getTime())) return false;
                if (from && orderDate < from) return false;
                if (to && orderDate > to) return false;
                return true;
              });
            }
            
            // Apply amount range
            if (state.filters.amountRange.min !== null) {
              filtered = filtered.filter((o) => 
                (o.totalAmount || 0) >= (state.filters.amountRange.min || 0)
              );
            }
            if (state.filters.amountRange.max !== null) {
              filtered = filtered.filter((o) => 
                (o.totalAmount || 0) <= (state.filters.amountRange.max || Infinity)
              );
            }
            
            // Apply sorting
            filtered.sort((a, b) => {
              const aVal = (a as any)[state.sort.column];
              const bVal = (b as any)[state.sort.column];
              const modifier = state.sort.direction === 'asc' ? 1 : -1;
              
              if (aVal < bVal) return -1 * modifier;
              if (aVal > bVal) return 1 * modifier;
              return 0;
            });
            
            return filtered;
          },
          getSelectedOrders: () => {
            const state = get();
            return state.orders.filter((o) => state.selectedIds.has(o.id));
          },
          getVisibleColumns: () => {
            const state = get();
            return state.columns
              .filter((c) => c.visible)
              .sort((a, b) => a.order - b.order);
          },
          getDirtyRowCount: () => get().dirtyRows.size,
          getSyncQueueCount: () => get().syncQueue.length,
        }),
        {
          name: 'orders-store',
          partialize: (state) => ({
            viewMode: state.viewMode,
            columns: state.columns,
            filterPresets: state.filterPresets,
            pageSize: state.pageSize,
            autoRefreshInterval: state.autoRefreshInterval,
            kanbanGroupBy: state.kanbanGroupBy,
            kanbanWipLimits: state.kanbanWipLimits,
            calendarView: state.calendarView,
            isSidebarOpen: state.isSidebarOpen,
          }),
        }
      )
    ),
    { name: 'OrdersStore' }
  )
);

// ============================================
// Selectors (for performance)
// ============================================

export const selectOrders = (state: OrdersState) => state.orders;
export const selectSelectedIds = (state: OrdersState) => state.selectedIds;
export const selectFilters = (state: OrdersState) => state.filters;
export const selectViewMode = (state: OrdersState) => state.viewMode;
export const selectIsLoading = (state: OrdersState) => state.isLoading;
export const selectColumns = (state: OrdersState) => state.columns;
export const selectDirtyRows = (state: OrdersState) => state.dirtyRows;
export const selectEditingCell = (state: OrdersState) => state.editingCell;
