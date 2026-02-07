/**
 * Enterprise View Store - Zustand
 * Multi-view state management with URL persistence
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  ViewType,
  ViewConfig,
  ListViewConfig,
  CalendarViewConfig,
  GanttViewConfig,
  DashboardViewConfig,
  DashboardWidget,
  ColumnDefinition,
} from '@/lib/types/enterprise';

// ============================================
// Default Configurations
// ============================================

export const DEFAULT_LIST_COLUMNS: ColumnDefinition[] = [
  { id: 'select', accessorKey: 'select', header: '', type: 'custom', width: 40, sortable: false, filterable: false, frozen: true },
  { id: 'orderNumber', accessorKey: 'orderNumber', header: 'Sipariş No', type: 'text', width: 120, sortable: true, frozen: true },
  { id: 'customerName', accessorKey: 'customerName', header: 'Müşteri', type: 'text', width: 180, sortable: true, filterable: true },
  { id: 'productName', accessorKey: 'productName', header: 'Ürün', type: 'text', width: 200, sortable: true, filterable: true },
  { id: 'status', accessorKey: 'status', header: 'Durum', type: 'status', width: 130, sortable: true, filterable: true },
  { id: 'priority', accessorKey: 'priority', header: 'Öncelik', type: 'priority', width: 100, sortable: true, filterable: true },
  { id: 'totalAmount', accessorKey: 'totalAmount', header: 'Tutar', type: 'currency', width: 120, sortable: true, align: 'right' },
  { id: 'date', accessorKey: 'date', header: 'Tarih', type: 'date', width: 110, sortable: true },
  { id: 'deliveryDate', accessorKey: 'deliveryDate', header: 'Teslim', type: 'date', width: 110, sortable: true },
  { id: 'progress', accessorKey: 'progress', header: 'İlerleme', type: 'progress', width: 100 },
  { id: 'actions', accessorKey: 'actions', header: '', type: 'custom', width: 80, sortable: false },
];

export const DEFAULT_LIST_CONFIG: ListViewConfig = {
  columns: DEFAULT_LIST_COLUMNS,
  rowHeight: 'normal',
  stripedRows: true,
  showGridLines: false,
  frozenColumns: 2,
};

export const DEFAULT_CALENDAR_CONFIG: CalendarViewConfig = {
  defaultView: 'dayGridMonth',
  firstDay: 1, // Monday
  slotMinTime: '08:00:00',
  slotMaxTime: '20:00:00',
  showWeekNumbers: true,
  businessHours: [
    { daysOfWeek: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '18:00' },
  ],
};

export const DEFAULT_GANTT_CONFIG: GanttViewConfig = {
  timeScale: 'day',
  showDependencies: true,
  showCriticalPath: true,
  showMilestones: true,
  showProgress: true,
  rowHeight: 40,
  columnWidth: 30,
};

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidget[] = [
  { id: 'total-orders', type: 'stats_card', title: 'Toplam Sipariş', x: 0, y: 0, width: 3, height: 2, config: { metric: 'order_count' } },
  { id: 'pending-orders', type: 'stats_card', title: 'Bekleyen', x: 3, y: 0, width: 3, height: 2, config: { metric: 'pending_count' } },
  { id: 'in-production', type: 'stats_card', title: 'Üretimde', x: 6, y: 0, width: 3, height: 2, config: { metric: 'production_count' } },
  { id: 'completed', type: 'stats_card', title: 'Tamamlanan', x: 9, y: 0, width: 3, height: 2, config: { metric: 'completed_count' } },
  { id: 'order-chart', type: 'chart_bar', title: 'Sipariş Trendi', x: 0, y: 2, width: 8, height: 4, config: { period: 'weekly' } },
  { id: 'status-pie', type: 'chart_pie', title: 'Durum Dağılımı', x: 8, y: 2, width: 4, height: 4, config: {} },
  { id: 'task-list', type: 'task_list', title: 'Yaklaşan Teslimler', x: 0, y: 6, width: 6, height: 4, config: { filter: 'due_soon' } },
  { id: 'workload', type: 'workload_heatmap', title: 'İş Yükü', x: 6, y: 6, width: 6, height: 4, config: {} },
];

export const DEFAULT_DASHBOARD_CONFIG: DashboardViewConfig = {
  widgets: DEFAULT_DASHBOARD_WIDGETS,
  layout: 'grid',
  columns: 12,
  rowHeight: 60,
};

// ============================================
// View Store State
// ============================================

interface ViewState {
  // Current view
  currentView: ViewType;
  previousView: ViewType | null;
  
  // View configurations
  listConfig: ListViewConfig;
  calendarConfig: CalendarViewConfig;
  ganttConfig: GanttViewConfig;
  dashboardConfig: DashboardViewConfig;
  
  // View-specific state
  calendarDate: string; // Current date in calendar
  ganttStartDate: string;
  ganttEndDate: string;
  
  // Sidebar
  sidebarCollapsed: boolean;
  detailPanelOpen: boolean;
  detailPanelTaskId: string | null;
  
  // Quick filters per view
  viewFilters: Record<ViewType, Record<string, unknown>>;
  
  // User preferences
  savedViews: ViewConfig[];
  
  // Animation
  isTransitioning: boolean;
}

interface ViewActions {
  // View switching
  setView: (view: ViewType) => void;
  toggleView: () => void;
  
  // List view
  updateListConfig: (config: Partial<ListViewConfig>) => void;
  updateColumnVisibility: (columnId: string, visible: boolean) => void;
  updateColumnOrder: (columnIds: string[]) => void;
  updateColumnWidth: (columnId: string, width: number) => void;
  resetListConfig: () => void;
  
  // Calendar view
  updateCalendarConfig: (config: Partial<CalendarViewConfig>) => void;
  setCalendarDate: (date: string) => void;
  
  // Gantt view
  updateGanttConfig: (config: Partial<GanttViewConfig>) => void;
  setGanttDateRange: (start: string, end: string) => void;
  zoomGantt: (direction: 'in' | 'out') => void;
  
  // Dashboard view
  updateDashboardConfig: (config: Partial<DashboardViewConfig>) => void;
  addWidget: (widget: DashboardWidget) => void;
  updateWidget: (widgetId: string, updates: Partial<DashboardWidget>) => void;
  removeWidget: (widgetId: string) => void;
  moveWidget: (widgetId: string, x: number, y: number) => void;
  resizeWidget: (widgetId: string, width: number, height: number) => void;
  
  // Sidebar & panels
  toggleSidebar: () => void;
  openDetailPanel: (taskId: string) => void;
  closeDetailPanel: () => void;
  
  // View filters
  setViewFilter: (view: ViewType, key: string, value: unknown) => void;
  clearViewFilters: (view: ViewType) => void;
  
  // Saved views
  saveCurrentView: (name: string) => void;
  loadSavedView: (viewId: string) => void;
  deleteSavedView: (viewId: string) => void;
  
  // Transition
  setTransitioning: (value: boolean) => void;
}

type ViewStore = ViewState & ViewActions;

// ============================================
// Initial State
// ============================================

const initialState: ViewState = {
  currentView: 'board',
  previousView: null,
  
  listConfig: DEFAULT_LIST_CONFIG,
  calendarConfig: DEFAULT_CALENDAR_CONFIG,
  ganttConfig: DEFAULT_GANTT_CONFIG,
  dashboardConfig: DEFAULT_DASHBOARD_CONFIG,
  
  calendarDate: new Date().toISOString().split('T')[0],
  ganttStartDate: new Date().toISOString().split('T')[0],
  ganttEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  
  sidebarCollapsed: false,
  detailPanelOpen: false,
  detailPanelTaskId: null,
  
  viewFilters: {
    list: {},
    board: {},
    calendar: {},
    gantt: {},
    dashboard: {},
    map: {},
  },
  
  savedViews: [],
  isTransitioning: false,
};

// ============================================
// Gantt Time Scale Mapping
// ============================================

const GANTT_SCALES: GanttViewConfig['timeScale'][] = ['hour', 'day', 'week', 'month', 'quarter', 'year'];

// ============================================
// Store Implementation
// ============================================

export const useViewStore = create<ViewStore>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          ...initialState,

          // View switching
          setView: (view) =>
            set((state) => {
              state.previousView = state.currentView;
              state.currentView = view;
              state.isTransitioning = true;
            }),

          toggleView: () => {
            const views: ViewType[] = ['list', 'board', 'calendar', 'gantt', 'dashboard'];
            const currentIndex = views.indexOf(get().currentView);
            const nextIndex = (currentIndex + 1) % views.length;
            get().setView(views[nextIndex]);
          },

          // List view
          updateListConfig: (config) =>
            set((state) => {
              state.listConfig = { ...state.listConfig, ...config };
            }),

          updateColumnVisibility: (columnId, visible) =>
            set((state) => {
              const column = state.listConfig.columns.find((c) => c.id === columnId);
              if (column) column.visible = visible;
            }),

          updateColumnOrder: (columnIds) =>
            set((state) => {
              const columnsMap = new Map(state.listConfig.columns.map((c) => [c.id, c]));
              state.listConfig.columns = columnIds
                .map((id) => columnsMap.get(id))
                .filter(Boolean) as ColumnDefinition[];
            }),

          updateColumnWidth: (columnId, width) =>
            set((state) => {
              const column = state.listConfig.columns.find((c) => c.id === columnId);
              if (column) column.width = width;
            }),

          resetListConfig: () =>
            set((state) => {
              state.listConfig = DEFAULT_LIST_CONFIG;
            }),

          // Calendar view
          updateCalendarConfig: (config) =>
            set((state) => {
              state.calendarConfig = { ...state.calendarConfig, ...config };
            }),

          setCalendarDate: (date) =>
            set((state) => {
              state.calendarDate = date;
            }),

          // Gantt view
          updateGanttConfig: (config) =>
            set((state) => {
              state.ganttConfig = { ...state.ganttConfig, ...config };
            }),

          setGanttDateRange: (start, end) =>
            set((state) => {
              state.ganttStartDate = start;
              state.ganttEndDate = end;
            }),

          zoomGantt: (direction) =>
            set((state) => {
              const currentIndex = GANTT_SCALES.indexOf(state.ganttConfig.timeScale);
              if (direction === 'in' && currentIndex > 0) {
                state.ganttConfig.timeScale = GANTT_SCALES[currentIndex - 1];
              } else if (direction === 'out' && currentIndex < GANTT_SCALES.length - 1) {
                state.ganttConfig.timeScale = GANTT_SCALES[currentIndex + 1];
              }
            }),

          // Dashboard view
          updateDashboardConfig: (config) =>
            set((state) => {
              state.dashboardConfig = { ...state.dashboardConfig, ...config };
            }),

          addWidget: (widget) =>
            set((state) => {
              state.dashboardConfig.widgets.push(widget);
            }),

          updateWidget: (widgetId, updates) =>
            set((state) => {
              const widget = state.dashboardConfig.widgets.find((w) => w.id === widgetId);
              if (widget) Object.assign(widget, updates);
            }),

          removeWidget: (widgetId) =>
            set((state) => {
              state.dashboardConfig.widgets = state.dashboardConfig.widgets.filter(
                (w) => w.id !== widgetId
              );
            }),

          moveWidget: (widgetId, x, y) =>
            set((state) => {
              const widget = state.dashboardConfig.widgets.find((w) => w.id === widgetId);
              if (widget) {
                widget.x = x;
                widget.y = y;
              }
            }),

          resizeWidget: (widgetId, width, height) =>
            set((state) => {
              const widget = state.dashboardConfig.widgets.find((w) => w.id === widgetId);
              if (widget) {
                widget.width = width;
                widget.height = height;
              }
            }),

          // Sidebar & panels
          toggleSidebar: () =>
            set((state) => {
              state.sidebarCollapsed = !state.sidebarCollapsed;
            }),

          openDetailPanel: (taskId) =>
            set((state) => {
              state.detailPanelOpen = true;
              state.detailPanelTaskId = taskId;
            }),

          closeDetailPanel: () =>
            set((state) => {
              state.detailPanelOpen = false;
              state.detailPanelTaskId = null;
            }),

          // View filters
          setViewFilter: (view, key, value) =>
            set((state) => {
              state.viewFilters[view][key] = value;
            }),

          clearViewFilters: (view) =>
            set((state) => {
              state.viewFilters[view] = {};
            }),

          // Saved views
          saveCurrentView: (name) =>
            set((state) => {
              const viewConfig: ViewConfig = {
                type: state.currentView,
                name,
                icon: getViewIcon(state.currentView),
                settings: getViewSettings(state),
              };
              state.savedViews.push(viewConfig);
            }),

          loadSavedView: (viewId) => {
            const savedView = get().savedViews.find((v) => v.name === viewId);
            if (savedView) {
              set((state) => {
                state.currentView = savedView.type;
                if (savedView.settings) {
                  applyViewSettings(state, savedView.settings);
                }
              });
            }
          },

          deleteSavedView: (viewId) =>
            set((state) => {
              state.savedViews = state.savedViews.filter((v) => v.name !== viewId);
            }),

          // Transition
          setTransitioning: (value) =>
            set((state) => {
              state.isTransitioning = value;
            }),
        }))
      ),
      {
        name: 'renkflow-view-store',
        partialize: (state) => ({
          currentView: state.currentView,
          listConfig: state.listConfig,
          calendarConfig: state.calendarConfig,
          ganttConfig: state.ganttConfig,
          dashboardConfig: state.dashboardConfig,
          sidebarCollapsed: state.sidebarCollapsed,
          savedViews: state.savedViews,
        }),
      }
    ),
    { name: 'ViewStore' }
  )
);

// ============================================
// Helper Functions
// ============================================

function getViewIcon(view: ViewType): string {
  const icons: Record<ViewType, string> = {
    list: 'List',
    board: 'Kanban',
    calendar: 'Calendar',
    gantt: 'GanttChart',
    dashboard: 'LayoutDashboard',
    map: 'Map',
  };
  return icons[view];
}

function getViewSettings(state: ViewState): Record<string, unknown> {
  switch (state.currentView) {
    case 'list':
      return { listConfig: state.listConfig };
    case 'calendar':
      return { calendarConfig: state.calendarConfig, calendarDate: state.calendarDate };
    case 'gantt':
      return { ganttConfig: state.ganttConfig, ganttStartDate: state.ganttStartDate, ganttEndDate: state.ganttEndDate };
    case 'dashboard':
      return { dashboardConfig: state.dashboardConfig };
    default:
      return {};
  }
}

function applyViewSettings(state: ViewState, settings: Record<string, unknown>): void {
  if (settings.listConfig) state.listConfig = settings.listConfig as ListViewConfig;
  if (settings.calendarConfig) state.calendarConfig = settings.calendarConfig as CalendarViewConfig;
  if (settings.calendarDate) state.calendarDate = settings.calendarDate as string;
  if (settings.ganttConfig) state.ganttConfig = settings.ganttConfig as GanttViewConfig;
  if (settings.ganttStartDate) state.ganttStartDate = settings.ganttStartDate as string;
  if (settings.ganttEndDate) state.ganttEndDate = settings.ganttEndDate as string;
  if (settings.dashboardConfig) state.dashboardConfig = settings.dashboardConfig as DashboardViewConfig;
}

// ============================================
// Selectors
// ============================================

export const selectCurrentView = (state: ViewStore) => state.currentView;
export const selectListConfig = (state: ViewStore) => state.listConfig;
export const selectCalendarConfig = (state: ViewStore) => state.calendarConfig;
export const selectGanttConfig = (state: ViewStore) => state.ganttConfig;
export const selectDashboardConfig = (state: ViewStore) => state.dashboardConfig;
export const selectIsTransitioning = (state: ViewStore) => state.isTransitioning;
export const selectDetailPanel = (state: ViewStore) => ({
  isOpen: state.detailPanelOpen,
  taskId: state.detailPanelTaskId,
});
