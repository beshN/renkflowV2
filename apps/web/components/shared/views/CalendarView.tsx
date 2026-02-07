'use client';

/**
 * Calendar View Component
 * FullCalendar-style implementation with drag-and-drop
 */

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useViewStore } from '@/lib/stores/view.store';
import type { Order, OrderStatus } from '@/lib/types';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Filter,
  Settings,
  List,
  Grid3X3,
  Clock,
  MoreHorizontal,
  Package,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface CalendarViewProps {
  data: Order[];
  isLoading?: boolean;
  onDateClick?: (date: Date) => void;
  onEventClick?: (order: Order) => void;
  onEventDrop?: (orderId: string, newDate: Date) => void;
  onCreateOrder?: (date: Date) => void;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  endDate?: Date;
  order: Order;
  color: string;
}

type CalendarViewMode = 'month' | 'week' | 'day' | 'list';

// ============================================
// Constants
// ============================================

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const WEEKDAYS_FULL = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-amber-500',
  in_production: 'bg-blue-500',
  delivered: 'bg-green-500',
};

// ============================================
// Helper Functions
// ============================================

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Add days from previous month to fill the first week
  const firstDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    days.push(date);
  }

  // Add days of current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }

  // Add days from next month to complete the last week
  const remainingDays = 42 - days.length; // 6 weeks * 7 days
  for (let i = 1; i <= remainingDays; i++) {
    days.push(new Date(year, month + 1, i));
  }

  return days;
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ============================================
// Calendar Header
// ============================================

function CalendarHeader({
  currentDate,
  viewMode,
  onPrevious,
  onNext,
  onToday,
  onViewModeChange,
}: {
  currentDate: Date;
  viewMode: CalendarViewMode;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="flex items-center gap-4">
        <button
          onClick={onToday}
          className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          Bugün
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={onPrevious}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} className="text-slate-600 dark:text-slate-400" />
          </button>
          <button
            onClick={onNext}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ChevronRight size={20} className="text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        {/* View Mode Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => onViewModeChange('month')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors',
              viewMode === 'month'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            <Grid3X3 size={16} className="inline mr-1" />
            Ay
          </button>
          <button
            onClick={() => onViewModeChange('week')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors',
              viewMode === 'week'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            <CalendarIcon size={16} className="inline mr-1" />
            Hafta
          </button>
          <button
            onClick={() => onViewModeChange('day')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors',
              viewMode === 'day'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            <Clock size={16} className="inline mr-1" />
            Gün
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors',
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            <List size={16} className="inline mr-1" />
            Liste
          </button>
        </div>

        <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
          <Filter size={18} className="text-slate-500" />
        </button>
        <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
          <Settings size={18} className="text-slate-500" />
        </button>
      </div>
    </div>
  );
}

// ============================================
// Calendar Day Cell
// ============================================

function CalendarDayCell({
  date,
  events,
  isCurrentMonth,
  onDateClick,
  onEventClick,
  onCreateOrder,
}: {
  date: Date;
  events: CalendarEvent[];
  isCurrentMonth: boolean;
  onDateClick?: (date: Date) => void;
  onEventClick?: (order: Order) => void;
  onCreateOrder?: (date: Date) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const maxVisible = 3;
  const hiddenCount = events.length - maxVisible;

  return (
    <div
      className={cn(
        'min-h-[120px] border-r border-b border-slate-200 dark:border-slate-700 p-1 transition-colors',
        !isCurrentMonth && 'bg-slate-50 dark:bg-slate-800/50',
        isToday(date) && 'bg-blue-50 dark:bg-blue-900/20'
      )}
      onClick={() => onDateClick?.(date)}
    >
      {/* Date Number */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            'flex items-center justify-center w-7 h-7 text-sm rounded-full',
            isToday(date)
              ? 'bg-blue-600 text-white font-semibold'
              : isCurrentMonth
              ? 'text-slate-900 dark:text-white'
              : 'text-slate-400 dark:text-slate-600'
          )}
        >
          {date.getDate()}
        </span>
        <button
          onClick={(e: React.MouseEvent<HTMLElement>) => {
            e.stopPropagation();
            onCreateOrder?.(date);
          }}
          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Plus size={14} className="text-slate-500" />
        </button>
      </div>

      {/* Events */}
      <div className="space-y-1">
        {events.slice(0, showAll ? events.length : maxVisible).map((event) => (
          <motion.button
            key={event.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e: React.MouseEvent<HTMLElement>) => {
              e.stopPropagation();
              onEventClick?.(event.order);
            }}
            className={cn(
              'w-full text-left px-2 py-1 rounded text-xs font-medium truncate transition-colors',
              event.color,
              'text-white hover:opacity-90'
            )}
            title={event.title}
          >
            {event.title}
          </motion.button>
        ))}

        {!showAll && hiddenCount > 0 && (
          <button
            onClick={(e: React.MouseEvent<HTMLElement>) => {
              e.stopPropagation();
              setShowAll(true);
            }}
            className="w-full text-left px-2 py-0.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            +{hiddenCount} daha
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// Week View
// ============================================

function WeekView({
  currentDate,
  events,
  onEventClick,
  onCreateOrder,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick?: (order: Order) => void;
  onCreateOrder?: (date: Date) => void;
}) {
  // Get start of week (Monday)
  const startOfWeek = new Date(currentDate);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfWeek);
    date.setDate(date.getDate() + i);
    return date;
  });

  const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[800px]">
        {/* Header */}
        <div className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div className="p-2 border-r border-slate-200 dark:border-slate-700" />
          {weekDays.map((date, i) => (
            <div
              key={i}
              className={cn(
                'p-2 text-center border-r border-slate-200 dark:border-slate-700',
                isToday(date) && 'bg-blue-50 dark:bg-blue-900/20'
              )}
            >
              <div className="text-xs text-slate-500 uppercase">{WEEKDAYS[i]}</div>
              <div
                className={cn(
                  'text-lg font-semibold',
                  isToday(date) ? 'text-blue-600' : 'text-slate-900 dark:text-white'
                )}
              >
                {date.getDate()}
              </div>
            </div>
          ))}
        </div>

        {/* Time Grid */}
        {hours.map((hour) => (
          <div key={hour} className="grid grid-cols-8 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2 text-xs text-slate-500 text-right pr-3 border-r border-slate-200 dark:border-slate-700">
              {hour.toString().padStart(2, '0')}:00
            </div>
            {weekDays.map((date, i) => {
              const dayEvents = events.filter((e) => isSameDay(e.date, date));
              return (
                <div
                  key={i}
                  className={cn(
                    'min-h-[60px] border-r border-slate-100 dark:border-slate-800 p-1',
                    isToday(date) && 'bg-blue-50/50 dark:bg-blue-900/10'
                  )}
                  onClick={() => onCreateOrder?.(new Date(date.setHours(hour)))}
                >
                  {hour === 8 &&
                    dayEvents.slice(0, 3).map((event) => (
                      <button
                        key={event.id}
                        onClick={(e: React.MouseEvent<HTMLElement>) => {
                          e.stopPropagation();
                          onEventClick?.(event.order);
                        }}
                        className={cn(
                          'w-full text-left px-2 py-1 rounded text-xs font-medium truncate mb-1',
                          event.color,
                          'text-white hover:opacity-90'
                        )}
                      >
                        {event.title}
                      </button>
                    ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Day View
// ============================================

function DayView({
  currentDate,
  events,
  onEventClick,
  onCreateOrder,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick?: (order: Order) => void;
  onCreateOrder?: (date: Date) => void;
}) {
  const dayEvents = events.filter((e) => isSameDay(e.date, currentDate));
  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7 AM to 8 PM

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          {formatDate(currentDate)}
        </h3>

        <div className="space-y-1">
          {hours.map((hour) => (
            <div
              key={hour}
              className="flex gap-4 py-3 border-b border-slate-100 dark:border-slate-800"
              onClick={() => onCreateOrder?.(new Date(currentDate.setHours(hour)))}
            >
              <div className="w-16 text-sm text-slate-500 text-right">
                {hour.toString().padStart(2, '0')}:00
              </div>
              <div className="flex-1">
                {hour === 9 &&
                  dayEvents.map((event) => (
                    <button
                      key={event.id}
                      onClick={(e: React.MouseEvent<HTMLElement>) => {
                        e.stopPropagation();
                        onEventClick?.(event.order);
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-lg text-sm font-medium mb-2',
                        event.color,
                        'text-white hover:opacity-90'
                      )}
                    >
                      <div className="font-semibold">{event.title}</div>
                      <div className="text-xs opacity-75">
                        {event.order.customerName}
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// List View
// ============================================

function CalendarListView({
  currentDate,
  events,
  onEventClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick?: (order: Order) => void;
}) {
  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups: Record<string, CalendarEvent[]> = {};
    events.forEach((event) => {
      const key = event.date.toISOString().split('T')[0];
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .filter(([date]) => {
        const eventDate = new Date(date);
        return eventDate.getMonth() === currentDate.getMonth();
      });
  }, [events, currentDate]);

  return (
    <div className="flex-1 overflow-auto p-4">
      {groupedEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <CalendarIcon size={48} className="text-slate-300 mb-4" />
          <p className="font-medium">Bu ay için etkinlik yok</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedEvents.map(([date, dayEvents]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2">
                {new Date(date).toLocaleDateString('tr-TR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </h3>
              <div className="space-y-2">
                {dayEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => onEventClick?.(event.order)}
                    className="w-full flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors text-left"
                  >
                    <div className={cn('w-1 h-12 rounded-full', event.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 dark:text-white truncate">
                        {event.title}
                      </div>
                      <div className="text-sm text-slate-500 truncate">
                        {event.order.customerName} • {event.order.productName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {event.order.currency}{event.order.totalAmount.toLocaleString('tr-TR')}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Calendar View Component
// ============================================

export function CalendarView({
  data,
  isLoading = false,
  onDateClick,
  onEventClick,
  onEventDrop,
  onCreateOrder,
}: CalendarViewProps) {
  const { calendarConfig, calendarDate, setCalendarDate } = useViewStore();
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const currentDate = new Date(calendarDate);

  // Convert orders to calendar events
  const events: CalendarEvent[] = useMemo(() => {
    return data
      .filter((order) => order.deliveryDate)
      .map((order) => ({
        id: order.id as string,
        title: `#${order.orderNumber} - ${order.productName || order.customerName}`,
        date: new Date(order.deliveryDate!),
        order,
        color: STATUS_COLORS[order.status],
      }));
  }, [data]);

  // Get days for month view
  const days = useMemo(() => {
    return getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  }, [currentDate]);

  // Navigation handlers
  const goToPrevious = useCallback(() => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCalendarDate(newDate.toISOString().split('T')[0]);
  }, [currentDate, viewMode, setCalendarDate]);

  const goToNext = useCallback(() => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCalendarDate(newDate.toISOString().split('T')[0]);
  }, [currentDate, viewMode, setCalendarDate]);

  const goToToday = useCallback(() => {
    setCalendarDate(new Date().toISOString().split('T')[0]);
  }, [setCalendarDate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      <CalendarHeader
        currentDate={currentDate}
        viewMode={viewMode}
        onPrevious={goToPrevious}
        onNext={goToNext}
        onToday={goToToday}
        onViewModeChange={setViewMode}
      />

      {viewMode === 'month' && (
        <div className="flex-1 overflow-auto">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="p-2 text-center text-xs font-semibold text-slate-500 uppercase"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {days.map((date, index) => {
              const dayEvents = events.filter((e) => isSameDay(e.date, date));
              return (
                <CalendarDayCell
                  key={index}
                  date={date}
                  events={dayEvents}
                  isCurrentMonth={date.getMonth() === currentDate.getMonth()}
                  onDateClick={onDateClick}
                  onEventClick={onEventClick}
                  onCreateOrder={onCreateOrder}
                />
              );
            })}
          </div>
        </div>
      )}

      {viewMode === 'week' && (
        <WeekView
          currentDate={currentDate}
          events={events}
          onEventClick={onEventClick}
          onCreateOrder={onCreateOrder}
        />
      )}

      {viewMode === 'day' && (
        <DayView
          currentDate={currentDate}
          events={events}
          onEventClick={onEventClick}
          onCreateOrder={onCreateOrder}
        />
      )}

      {viewMode === 'list' && (
        <CalendarListView
          currentDate={currentDate}
          events={events}
          onEventClick={onEventClick}
        />
      )}
    </div>
  );
}
