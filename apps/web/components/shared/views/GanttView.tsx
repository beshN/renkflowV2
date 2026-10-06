'use client';

/**
 * Gantt/Timeline View Component
 * Visual timeline with dependency lines and critical path highlighting
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useViewStore } from '@/lib/stores/view.store';
import type { Order, OrderStatus } from '@/lib/types';
import type { Dependency, DependencyType } from '@/lib/types/enterprise';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Settings,
  Filter,
  Link2,
  Clock,
  CheckCircle2,
  Package,
  AlertTriangle,
  MoreHorizontal,
  Calendar,
  Milestone,
} from 'lucide-react';
import { CutLoader } from '@/components/brand/CutLoader';

// ============================================
// Types
// ============================================

interface GanttViewProps {
  data: Order[];
  dependencies?: Dependency[];
  isLoading?: boolean;
  onTaskClick?: (order: Order) => void;
  onTaskDrag?: (orderId: string, newStartDate: Date, newEndDate: Date) => void;
  onDependencyCreate?: (sourceId: string, targetId: string, type: DependencyType) => void;
}

interface GanttTask {
  id: string;
  name: string;
  start: Date;
  end: Date;
  progress: number;
  order: Order;
  isCritical: boolean;
  dependencies: string[];
}

interface TimelineConfig {
  startDate: Date;
  endDate: Date;
  dayWidth: number;
  rowHeight: number;
}

// ============================================
// Constants
// ============================================

const STATUS_COLORS: Record<OrderStatus, { bg: string; border: string }> = {
  pending: { bg: 'bg-amber-500', border: 'border-amber-600' },
  in_production: { bg: 'bg-blue-500', border: 'border-blue-600' },
  delivered: { bg: 'bg-green-500', border: 'border-green-600' },
};

const ZOOM_LEVELS = [
  { scale: 'hour', dayWidth: 240, label: 'Saat' },
  { scale: 'day', dayWidth: 40, label: 'Gün' },
  { scale: 'week', dayWidth: 20, label: 'Hafta' },
  { scale: 'month', dayWidth: 8, label: 'Ay' },
  { scale: 'quarter', dayWidth: 3, label: 'Çeyrek' },
];

const MONTHS_TR = [
  'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'
];

// ============================================
// Helper Functions
// ============================================

function getDaysBetween(start: Date, end: Date): number {
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

function getDatePosition(date: Date, config: TimelineConfig): number {
  const daysDiff = getDaysBetween(config.startDate, date);
  return daysDiff * config.dayWidth;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// ============================================
// Timeline Header
// ============================================

function TimelineHeader({ config }: { config: TimelineConfig }) {
  const totalDays = getDaysBetween(config.startDate, config.endDate);
  const totalWidth = totalDays * config.dayWidth;

  // Generate month headers
  const months: { month: number; year: number; days: number; startX: number }[] = [];
  let currentDate = new Date(config.startDate);
  let accumulatedDays = 0;

  while (currentDate <= config.endDate) {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const remainingDays = Math.min(
      daysInMonth - currentDate.getDate() + 1,
      getDaysBetween(currentDate, config.endDate) + 1
    );

    months.push({
      month,
      year,
      days: remainingDays,
      startX: accumulatedDays * config.dayWidth,
    });

    accumulatedDays += remainingDays;
    currentDate = new Date(year, month + 1, 1);
  }

  // Generate day headers
  const days: { date: Date; x: number }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const date = addDays(config.startDate, i);
    days.push({ date, x: i * config.dayWidth });
  }

  return (
    <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
      {/* Month Row */}
      <div className="flex h-8 border-b border-slate-200 dark:border-slate-700">
        {months.map((m, i) => (
          <div
            key={i}
            className="flex items-center justify-center text-xs font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700"
            style={{ width: m.days * config.dayWidth }}
          >
            {MONTHS_TR[m.month]} {m.year}
          </div>
        ))}
      </div>

      {/* Day Row */}
      {config.dayWidth >= 20 && (
        <div className="flex h-6">
          {days.map((d, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center justify-center text-xs border-r border-slate-100 dark:border-slate-800',
                isWeekend(d.date)
                  ? 'bg-slate-50 dark:bg-slate-800/50 text-slate-400'
                  : 'text-slate-500'
              )}
              style={{ width: config.dayWidth }}
            >
              {config.dayWidth >= 30 ? d.date.getDate() : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// Task Row
// ============================================

function TaskRow({
  task,
  config,
  isSelected,
  onTaskClick,
  dependencies,
}: {
  task: GanttTask;
  config: TimelineConfig;
  isSelected: boolean;
  onTaskClick?: (order: Order) => void;
  dependencies?: Dependency[];
}) {
  const startX = getDatePosition(task.start, config);
  const endX = getDatePosition(task.end, config);
  const width = Math.max(endX - startX, config.dayWidth);
  const colors = STATUS_COLORS[task.order.status];

  const isOverdue = task.end < new Date() && task.order.status !== 'delivered';

  return (
    <div
      className={cn(
        'relative h-full flex items-center',
        isSelected && 'bg-blue-50 dark:bg-blue-900/20'
      )}
      style={{ paddingLeft: startX }}
    >
      {/* Task Bar */}
      <motion.div
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        className={cn(
          'relative h-8 rounded-md cursor-pointer group',
          colors.bg,
          task.isCritical && 'ring-2 ring-red-500 ring-offset-1',
          isOverdue && 'ring-2 ring-red-500'
        )}
        style={{ width, originX: 0 }}
        onClick={() => onTaskClick?.(task.order)}
      >
        {/* Progress Fill */}
        <div
          className="absolute inset-0 bg-black/20 rounded-md"
          style={{ width: `${task.progress}%` }}
        />

        {/* Task Label */}
        <div className="absolute inset-0 flex items-center px-2 text-white text-xs font-medium truncate">
          {task.name}
        </div>

        {/* Critical Path Indicator */}
        {task.isCritical && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
        )}

        {/* Overdue Indicator */}
        {isOverdue && (
          <div className="absolute -top-1 -left-1">
            <AlertTriangle size={12} className="text-red-500" />
          </div>
        )}

        {/* Hover Actions */}
        <div className="absolute right-0 top-0 bottom-0 flex items-center pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="p-1 bg-white/20 rounded hover:bg-white/30">
            <MoreHorizontal size={12} className="text-white" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================
// Task List (Left Panel)
// ============================================

function TaskList({
  tasks,
  config,
  selectedTaskId,
  onTaskSelect,
}: {
  tasks: GanttTask[];
  config: TimelineConfig;
  selectedTaskId: string | null;
  onTaskSelect: (taskId: string) => void;
}) {
  return (
    <div className="w-64 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0">
      {/* Header */}
      <div className="h-14 border-b border-slate-200 dark:border-slate-700 flex items-center px-4">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Görev Adı
        </span>
      </div>

      {/* Task Names */}
      <div>
        {tasks.map((task) => (
          <div
            key={task.id}
            onClick={() => onTaskSelect(task.id)}
            className={cn(
              'flex items-center gap-2 px-4 border-b border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800',
              selectedTaskId === task.id && 'bg-blue-50 dark:bg-blue-900/20'
            )}
            style={{ height: config.rowHeight }}
          >
            {/* Status Icon */}
            {task.order.status === 'delivered' ? (
              <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
            ) : task.order.status === 'in_production' ? (
              <Package size={14} className="text-blue-500 flex-shrink-0" />
            ) : (
              <Clock size={14} className="text-amber-500 flex-shrink-0" />
            )}

            {/* Task Info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                #{task.order.orderNumber}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {task.order.customerName}
              </div>
            </div>

            {/* Dependencies Indicator */}
            {task.dependencies.length > 0 && (
              <Link2 size={12} className="text-slate-400 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Dependency Lines SVG
// ============================================

function DependencyLines({
  tasks,
  dependencies,
  config,
}: {
  tasks: GanttTask[];
  dependencies: Dependency[];
  config: TimelineConfig;
}) {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  return (
    <svg className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible' }}>
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="10"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
        </marker>
      </defs>

      {dependencies.map((dep) => {
        const sourceTask = taskMap.get(dep.sourceTaskId);
        const targetTask = taskMap.get(dep.targetTaskId);

        if (!sourceTask || !targetTask) return null;

        const sourceIndex = tasks.findIndex((t) => t.id === dep.sourceTaskId);
        const targetIndex = tasks.findIndex((t) => t.id === dep.targetTaskId);

        const sourceX = getDatePosition(sourceTask.end, config);
        const sourceY = sourceIndex * config.rowHeight + config.rowHeight / 2;
        const targetX = getDatePosition(targetTask.start, config);
        const targetY = targetIndex * config.rowHeight + config.rowHeight / 2;

        // Create a curved path
        const midX = (sourceX + targetX) / 2;
        const path = `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`;

        return (
          <path
            key={dep.id}
            d={path}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeDasharray={dep.isHard ? undefined : '4,4'}
            markerEnd="url(#arrowhead)"
          />
        );
      })}
    </svg>
  );
}

// ============================================
// Today Line
// ============================================

function TodayLine({ config }: { config: TimelineConfig }) {
  const today = new Date();
  if (today < config.startDate || today > config.endDate) return null;

  const x = getDatePosition(today, config);

  return (
    <div
      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
      style={{ left: x }}
    >
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded">
        Bugün
      </div>
    </div>
  );
}

// ============================================
// Main Gantt View Component
// ============================================

export function GanttView({
  data,
  dependencies = [],
  isLoading = false,
  onTaskClick,
  onTaskDrag,
  onDependencyCreate,
}: GanttViewProps) {
  const { ganttConfig, zoomGantt, setGanttDateRange } = useViewStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [zoomIndex, setZoomIndex] = useState(1); // Default to 'day'

  // Convert orders to Gantt tasks
  const tasks: GanttTask[] = useMemo(() => {
    return data
      .filter((order) => order.date && order.deliveryDate)
      .map((order) => ({
        id: order.id as string,
        name: `#${order.orderNumber} - ${order.productName || order.customerName}`,
        start: new Date(order.date),
        end: new Date(order.deliveryDate!),
        progress: order.status === 'delivered' ? 100 : order.status === 'in_production' ? 50 : 0,
        order,
        isCritical: false, // Would be calculated by critical path algorithm
        dependencies: [],
      }));
  }, [data]);

  // Calculate timeline config
  const config: TimelineConfig = useMemo(() => {
    if (tasks.length === 0) {
      const today = new Date();
      return {
        startDate: addDays(today, -7),
        endDate: addDays(today, 30),
        dayWidth: ZOOM_LEVELS[zoomIndex].dayWidth,
        rowHeight: ganttConfig.rowHeight,
      };
    }

    const dates = tasks.flatMap((t) => [t.start, t.end]);
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    return {
      startDate: addDays(minDate, -7),
      endDate: addDays(maxDate, 14),
      dayWidth: ZOOM_LEVELS[zoomIndex].dayWidth,
      rowHeight: ganttConfig.rowHeight,
    };
  }, [tasks, zoomIndex, ganttConfig.rowHeight]);

  const totalWidth = getDaysBetween(config.startDate, config.endDate) * config.dayWidth;

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    if (zoomIndex > 0) setZoomIndex(zoomIndex - 1);
  }, [zoomIndex]);

  const handleZoomOut = useCallback(() => {
    if (zoomIndex < ZOOM_LEVELS.length - 1) setZoomIndex(zoomIndex + 1);
  }, [zoomIndex]);

  // Scroll to today on mount
  useEffect(() => {
    if (containerRef.current) {
      const todayX = getDatePosition(new Date(), config);
      containerRef.current.scrollLeft = todayX - containerRef.current.clientWidth / 3;
    }
  }, [config]);

  if (isLoading) {
    return (
      <CutLoader variant="area" className="h-full" />
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Gantt Görünümü
          </h2>
          <span className="text-sm text-slate-500">
            {tasks.length} görev
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={handleZoomIn}
              disabled={zoomIndex === 0}
              className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Yakınlaştır"
            >
              <ZoomIn size={16} className="text-slate-600 dark:text-slate-400" />
            </button>
            <span className="px-2 text-xs font-medium text-slate-600 dark:text-slate-400 min-w-[60px] text-center">
              {ZOOM_LEVELS[zoomIndex].label}
            </span>
            <button
              onClick={handleZoomOut}
              disabled={zoomIndex === ZOOM_LEVELS.length - 1}
              className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Uzaklaştır"
            >
              <ZoomOut size={16} className="text-slate-600 dark:text-slate-400" />
            </button>
          </div>

          {/* View Options */}
          <div className="flex items-center gap-1">
            <button
              className={cn(
                'p-2 rounded-lg transition-colors',
                ganttConfig.showDependencies
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'
              )}
              title="Bağımlılıkları Göster"
            >
              <Link2 size={16} />
            </button>
            <button
              className={cn(
                'p-2 rounded-lg transition-colors',
                ganttConfig.showCriticalPath
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'
              )}
              title="Kritik Yolu Göster"
            >
              <AlertTriangle size={16} />
            </button>
            <button
              className={cn(
                'p-2 rounded-lg transition-colors',
                ganttConfig.showMilestones
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'
              )}
              title="Kilometre Taşlarını Göster"
            >
              <Milestone size={16} />
            </button>
          </div>

          <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <Filter size={16} className="text-slate-500" />
          </button>
          <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <Settings size={16} className="text-slate-500" />
          </button>
          <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <Maximize2 size={16} className="text-slate-500" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Task List */}
        <TaskList
          tasks={tasks}
          config={config}
          selectedTaskId={selectedTaskId}
          onTaskSelect={setSelectedTaskId}
        />

        {/* Timeline */}
        <div className="flex-1 overflow-auto" ref={containerRef}>
          <div style={{ width: totalWidth, minHeight: '100%' }} className="relative">
            {/* Header */}
            <TimelineHeader config={config} />

            {/* Grid Background */}
            <div className="absolute top-14 left-0 right-0 bottom-0">
              {/* Weekend Stripes */}
              {Array.from({ length: getDaysBetween(config.startDate, config.endDate) }).map((_, i) => {
                const date = addDays(config.startDate, i);
                if (!isWeekend(date)) return null;
                return (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 bg-slate-50 dark:bg-slate-800/30"
                    style={{
                      left: i * config.dayWidth,
                      width: config.dayWidth,
                    }}
                  />
                );
              })}

              {/* Today Line */}
              <TodayLine config={config} />

              {/* Dependency Lines */}
              {ganttConfig.showDependencies && (
                <DependencyLines
                  tasks={tasks}
                  dependencies={dependencies}
                  config={config}
                />
              )}
            </div>

            {/* Task Rows */}
            <div className="relative" style={{ paddingTop: config.dayWidth >= 20 ? 56 : 32 }}>
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="border-b border-slate-100 dark:border-slate-800"
                  style={{ height: config.rowHeight }}
                >
                  <TaskRow
                    task={task}
                    config={config}
                    isSelected={selectedTaskId === task.id}
                    onTaskClick={onTaskClick}
                    dependencies={dependencies}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-3 h-3 rounded bg-amber-500" />
          <span>Bekliyor</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span>Üretimde</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span>Teslim Edildi</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-3 h-3 rounded bg-slate-300 ring-2 ring-red-500" />
          <span>Kritik Yol</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-4 h-0.5 bg-red-500" />
          <span>Bugün</span>
        </div>
      </div>
    </div>
  );
}
