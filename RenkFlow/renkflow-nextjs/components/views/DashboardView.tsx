'use client';

/**
 * Dashboard View Component
 * Customizable widget-based dashboard with drag-and-drop
 */

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useViewStore } from '@/lib/stores/view.store';
import type { Order, OrderStatus } from '@/lib/types';
import type { DashboardWidget, WidgetType } from '@/lib/types/enterprise';
import {
  Plus,
  Settings,
  Maximize2,
  Minimize2,
  X,
  GripVertical,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  Package,
  Clock,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Users,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface DashboardViewProps {
  data: Order[];
  isLoading?: boolean;
}

interface WidgetData {
  value: number | string;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  chartData?: { date: string; value: number }[];
}

// ============================================
// Widget Registry
// ============================================

const WIDGET_REGISTRY: Record<WidgetType, {
  icon: React.ReactNode;
  label: string;
  minWidth: number;
  minHeight: number;
}> = {
  stats_card: { icon: <BarChart3 size={16} />, label: 'İstatistik Kartı', minWidth: 2, minHeight: 2 },
  chart_bar: { icon: <BarChart3 size={16} />, label: 'Çubuk Grafik', minWidth: 4, minHeight: 3 },
  chart_line: { icon: <Activity size={16} />, label: 'Çizgi Grafik', minWidth: 4, minHeight: 3 },
  chart_pie: { icon: <PieChart size={16} />, label: 'Pasta Grafik', minWidth: 3, minHeight: 3 },
  chart_donut: { icon: <PieChart size={16} />, label: 'Halka Grafik', minWidth: 3, minHeight: 3 },
  table: { icon: <BarChart3 size={16} />, label: 'Tablo', minWidth: 4, minHeight: 4 },
  kanban_summary: { icon: <Package size={16} />, label: 'Kanban Özet', minWidth: 6, minHeight: 3 },
  calendar_mini: { icon: <Calendar size={16} />, label: 'Mini Takvim', minWidth: 3, minHeight: 4 },
  task_list: { icon: <CheckCircle2 size={16} />, label: 'Görev Listesi', minWidth: 4, minHeight: 4 },
  burndown: { icon: <TrendingDown size={16} />, label: 'Burndown', minWidth: 6, minHeight: 4 },
  burnup: { icon: <TrendingUp size={16} />, label: 'Burnup', minWidth: 6, minHeight: 4 },
  cumulative_flow: { icon: <Activity size={16} />, label: 'Kümülatif Akış', minWidth: 6, minHeight: 4 },
  velocity: { icon: <TrendingUp size={16} />, label: 'Velocity', minWidth: 4, minHeight: 3 },
  cycle_time: { icon: <Clock size={16} />, label: 'Çevrim Süresi', minWidth: 4, minHeight: 3 },
  workload_heatmap: { icon: <Activity size={16} />, label: 'İş Yükü Haritası', minWidth: 6, minHeight: 4 },
  resource_allocation: { icon: <Users size={16} />, label: 'Kaynak Dağılımı', minWidth: 6, minHeight: 4 },
  custom: { icon: <Settings size={16} />, label: 'Özel Widget', minWidth: 2, minHeight: 2 },
};

// ============================================
// Stats Card Widget
// ============================================

function StatsCardWidget({
  widget,
  data,
}: {
  widget: DashboardWidget;
  data: WidgetData;
}) {
  const trend = data.trend || (data.change && data.change > 0 ? 'up' : data.change && data.change < 0 ? 'down' : 'neutral');
  
  return (
    <div className="h-full flex flex-col justify-center p-4">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{widget.title}</p>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-bold text-slate-900 dark:text-white">
          {typeof data.value === 'number' ? data.value.toLocaleString('tr-TR') : data.value}
        </span>
        {data.change !== undefined && (
          <div className={cn(
            'flex items-center gap-1 text-sm font-medium',
            trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-slate-500'
          )}>
            {trend === 'up' ? <TrendingUp size={16} /> : trend === 'down' ? <TrendingDown size={16} /> : null}
            <span>{Math.abs(data.change)}%</span>
          </div>
        )}
      </div>
      {data.chartData && (
        <div className="mt-3 h-12">
          <MiniSparkline data={data.chartData} trend={trend} />
        </div>
      )}
    </div>
  );
}

// ============================================
// Mini Sparkline
// ============================================

function MiniSparkline({
  data,
  trend,
}: {
  data: { date: string; value: number }[];
  trend: 'up' | 'down' | 'neutral';
}) {
  if (data.length < 2) return null;

  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((d.value - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  const color = trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : '#6b7280';

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ============================================
// Chart Widget (Bar/Line)
// ============================================

function ChartWidget({
  widget,
  data,
  type,
}: {
  widget: DashboardWidget;
  data: { label: string; value: number }[];
  type: 'bar' | 'line';
}) {
  const max = Math.max(...data.map((d) => d.value));

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex-1 flex items-end gap-1">
        {data.map((item, index) => (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div
              className={cn(
                'w-full rounded-t transition-all',
                type === 'bar' ? 'bg-blue-500' : 'bg-blue-500'
              )}
              style={{ height: `${(item.value / max) * 100}%`, minHeight: 4 }}
            />
            <span className="text-xs text-slate-500 mt-1 truncate w-full text-center">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Pie Chart Widget
// ============================================

function PieChartWidget({
  widget,
  data,
}: {
  widget: DashboardWidget;
  data: { label: string; value: number; color: string }[];
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let currentAngle = 0;

  return (
    <div className="h-full flex items-center justify-center p-4 gap-4">
      <svg viewBox="0 0 100 100" className="w-24 h-24">
        {data.map((item, index) => {
          const angle = (item.value / total) * 360;
          const startAngle = currentAngle;
          currentAngle += angle;

          const x1 = 50 + 40 * Math.cos((startAngle - 90) * Math.PI / 180);
          const y1 = 50 + 40 * Math.sin((startAngle - 90) * Math.PI / 180);
          const x2 = 50 + 40 * Math.cos((startAngle + angle - 90) * Math.PI / 180);
          const y2 = 50 + 40 * Math.sin((startAngle + angle - 90) * Math.PI / 180);
          const largeArc = angle > 180 ? 1 : 0;

          return (
            <path
              key={index}
              d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={item.color}
            />
          );
        })}
      </svg>
      <div className="flex flex-col gap-1">
        {data.map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
            <span className="text-slate-600 dark:text-slate-400">{item.label}</span>
            <span className="font-medium text-slate-900 dark:text-white">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Task List Widget
// ============================================

function TaskListWidget({
  widget,
  orders,
}: {
  widget: DashboardWidget;
  orders: Order[];
}) {
  const filteredOrders = orders
    .filter((o) => o.deliveryDate && new Date(o.deliveryDate) >= new Date())
    .sort((a, b) => new Date(a.deliveryDate!).getTime() - new Date(b.deliveryDate!).getTime())
    .slice(0, 5);

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex-1 overflow-auto">
        {filteredOrders.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            Yaklaşan teslim yok
          </div>
        ) : (
          <div className="space-y-2">
            {filteredOrders.map((order) => (
              <div
                key={order.id as string}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  order.status === 'delivered' ? 'bg-green-500' :
                  order.status === 'in_production' ? 'bg-blue-500' : 'bg-amber-500'
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    #{order.orderNumber}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{order.customerName}</p>
                </div>
                <span className="text-xs text-slate-500">
                  {order.deliveryDate && new Date(order.deliveryDate).toLocaleDateString('tr-TR')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Kanban Summary Widget
// ============================================

function KanbanSummaryWidget({
  widget,
  orders,
}: {
  widget: DashboardWidget;
  orders: Order[];
}) {
  const statusCounts = {
    pending: orders.filter((o) => o.status === 'pending').length,
    in_production: orders.filter((o) => o.status === 'in_production').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
  };

  const total = orders.length;

  return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="flex gap-4">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div key={status} className="flex flex-col items-center">
            <div className={cn(
              'w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold text-white',
              status === 'pending' ? 'bg-amber-500' :
              status === 'in_production' ? 'bg-blue-500' : 'bg-green-500'
            )}>
              {count}
            </div>
            <span className="text-xs text-slate-500 mt-2">
              {status === 'pending' ? 'Bekliyor' :
               status === 'in_production' ? 'Üretimde' : 'Teslim'}
            </span>
            <span className="text-xs text-slate-400">
              {total > 0 ? Math.round((count / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Widget Container
// ============================================

function WidgetContainer({
  widget,
  children,
  onRemove,
  onSettings,
  isEditing,
}: {
  widget: DashboardWidget;
  children: React.ReactNode;
  onRemove: () => void;
  onSettings: () => void;
  isEditing: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden',
        isEditing && 'ring-2 ring-blue-500 ring-offset-2'
      )}
      style={{
        gridColumn: `span ${widget.width}`,
        gridRow: `span ${widget.height}`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Widget Header */}
      <div className={cn(
        'flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-800 transition-opacity',
        !isHovered && !isEditing && 'opacity-0'
      )}>
        <div className="flex items-center gap-2">
          {isEditing && (
            <GripVertical size={14} className="text-slate-400 cursor-grab" />
          )}
          <span className="text-xs font-medium text-slate-500">{widget.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onSettings}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
          >
            <Settings size={12} className="text-slate-400" />
          </button>
          {isEditing && (
            <button
              onClick={onRemove}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
            >
              <X size={12} className="text-red-500" />
            </button>
          )}
        </div>
      </div>

      {/* Widget Content */}
      <div className="h-[calc(100%-36px)]">
        {children}
      </div>
    </motion.div>
  );
}

// ============================================
// Main Dashboard View
// ============================================

export function DashboardView({ data, isLoading = false }: DashboardViewProps) {
  const { dashboardConfig, updateWidget, removeWidget, addWidget } = useViewStore();
  const [isEditing, setIsEditing] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);

  // Calculate widget data
  const getWidgetData = useCallback((widget: DashboardWidget): WidgetData => {
    const metric = widget.config.metric as string;
    
    switch (metric) {
      case 'order_count':
        return { value: data.length, change: 12, trend: 'up' };
      case 'pending_count':
        return { value: data.filter((o) => o.status === 'pending').length };
      case 'production_count':
        return { value: data.filter((o) => o.status === 'in_production').length };
      case 'completed_count':
        return { value: data.filter((o) => o.status === 'delivered').length, change: 8, trend: 'up' };
      default:
        return { value: 0 };
    }
  }, [data]);

  const handleAddWidget = (type: WidgetType) => {
    addWidget({
      id: `widget_${Date.now()}`,
      type,
      title: WIDGET_REGISTRY[type].label,
      x: 0,
      y: 0,
      width: WIDGET_REGISTRY[type].minWidth,
      height: WIDGET_REGISTRY[type].minHeight,
      config: {},
    });
    setShowAddWidget(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Dashboard</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddWidget(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={16} />
            Widget Ekle
          </button>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg',
              isEditing
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            )}
          >
            <Settings size={16} />
            {isEditing ? 'Düzenlemeyi Bitir' : 'Düzenle'}
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${dashboardConfig.columns}, 1fr)`,
            gridAutoRows: dashboardConfig.rowHeight,
          }}
        >
          {dashboardConfig.widgets.map((widget) => (
            <WidgetContainer
              key={widget.id}
              widget={widget}
              isEditing={isEditing}
              onRemove={() => removeWidget(widget.id)}
              onSettings={() => {}}
            >
              {widget.type === 'stats_card' && (
                <StatsCardWidget widget={widget} data={getWidgetData(widget)} />
              )}
              {widget.type === 'chart_bar' && (
                <ChartWidget
                  widget={widget}
                  type="bar"
                  data={[
                    { label: 'Pzt', value: 12 },
                    { label: 'Sal', value: 19 },
                    { label: 'Çar', value: 8 },
                    { label: 'Per', value: 15 },
                    { label: 'Cum', value: 22 },
                  ]}
                />
              )}
              {widget.type === 'chart_pie' && (
                <PieChartWidget
                  widget={widget}
                  data={[
                    { label: 'Bekliyor', value: data.filter((o) => o.status === 'pending').length, color: '#f59e0b' },
                    { label: 'Üretimde', value: data.filter((o) => o.status === 'in_production').length, color: '#3b82f6' },
                    { label: 'Teslim', value: data.filter((o) => o.status === 'delivered').length, color: '#22c55e' },
                  ]}
                />
              )}
              {widget.type === 'task_list' && (
                <TaskListWidget widget={widget} orders={data} />
              )}
              {widget.type === 'kanban_summary' && (
                <KanbanSummaryWidget widget={widget} orders={data} />
              )}
              {widget.type === 'workload_heatmap' && (
                <WorkloadHeatmapWidget widget={widget} />
              )}
            </WidgetContainer>
          ))}
        </div>
      </div>

      {/* Add Widget Modal */}
      {showAddWidget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-xl p-6 w-[500px] max-h-[80vh] overflow-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Widget Ekle</h3>
              <button onClick={() => setShowAddWidget(false)} className="p-1 hover:bg-slate-100 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(WIDGET_REGISTRY).map(([type, info]) => (
                <button
                  key={type}
                  onClick={() => handleAddWidget(type as WidgetType)}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <span className="text-slate-600 dark:text-slate-400">{info.icon}</span>
                  <span className="text-sm text-slate-900 dark:text-white">{info.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Workload Heatmap Widget
// ============================================

function WorkloadHeatmapWidget({ widget }: { widget: DashboardWidget }) {
  const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const hours = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17'];

  // Generate mock data
  const heatmapData = useMemo(() => {
    return days.map((_, dayIndex) =>
      hours.map((_, hourIndex) => {
        // Simulate workload - higher during weekdays, mid-day
        const isWeekday = dayIndex < 5;
        const isMidDay = hourIndex >= 2 && hourIndex <= 7;
        const baseValue = isWeekday ? (isMidDay ? 0.7 : 0.4) : 0.1;
        return Math.min(1, baseValue + Math.random() * 0.3);
      })
    );
  }, []);

  const getColor = (value: number): string => {
    if (value < 0.3) return 'bg-green-100 dark:bg-green-900/30';
    if (value < 0.5) return 'bg-green-300 dark:bg-green-700/50';
    if (value < 0.7) return 'bg-yellow-300 dark:bg-yellow-700/50';
    if (value < 0.9) return 'bg-orange-400 dark:bg-orange-600/50';
    return 'bg-red-500 dark:bg-red-600/50';
  };

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex-1 flex gap-1">
        {/* Hour labels */}
        <div className="flex flex-col justify-between py-1">
          {hours.map((hour) => (
            <span key={hour} className="text-xs text-slate-400">{hour}</span>
          ))}
        </div>
        
        {/* Heatmap grid */}
        <div className="flex-1 flex gap-1">
          {days.map((day, dayIndex) => (
            <div key={day} className="flex-1 flex flex-col gap-1">
              {hours.map((_, hourIndex) => (
                <div
                  key={hourIndex}
                  className={cn(
                    'flex-1 rounded-sm transition-colors',
                    getColor(heatmapData[dayIndex][hourIndex])
                  )}
                  title={`${day} ${hours[hourIndex]}:00 - ${Math.round(heatmapData[dayIndex][hourIndex] * 100)}%`}
                />
              ))}
              <span className="text-xs text-slate-400 text-center">{day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-2">
        <span className="text-xs text-slate-500">Az</span>
        <div className="flex gap-0.5">
          <div className="w-4 h-3 rounded-sm bg-green-100 dark:bg-green-900/30" />
          <div className="w-4 h-3 rounded-sm bg-green-300 dark:bg-green-700/50" />
          <div className="w-4 h-3 rounded-sm bg-yellow-300 dark:bg-yellow-700/50" />
          <div className="w-4 h-3 rounded-sm bg-orange-400 dark:bg-orange-600/50" />
          <div className="w-4 h-3 rounded-sm bg-red-500 dark:bg-red-600/50" />
        </div>
        <span className="text-xs text-slate-500">Yoğun</span>
      </div>
    </div>
  );
}
