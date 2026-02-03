'use client';

/**
 * Calendar View
 * Month/Week/Day/Timeline views with drag-drop date changes
 */

import React, { useState, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  parseISO,
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { Order } from '@/lib/types';
import { useOrdersStore } from '@/lib/stores/orders.store';
import { formatCurrency, getOrderStatusInfo, cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ============================================
// Types
// ============================================

interface CalendarViewProps {
  orders: Order[];
  onOrderClick?: (order: Order) => void;
  onDateChange?: (orderId: string, newDate: string) => void;
}

type CalendarViewMode = 'month' | 'week' | 'day' | 'timeline';

const statusIndicatorMap: Record<Order['status'], string> = {
  pending: 'bg-yellow-500',
  in_production: 'bg-blue-500',
  delivered: 'bg-green-500',
};

// ============================================
// Order Badge
// ============================================

const OrderBadge: React.FC<{
  order: Order;
  compact?: boolean;
  onClick?: () => void;
}> = ({ order, compact = false, onClick }) => {
  const statusInfo = getOrderStatusInfo(order.status);
  const isOverdue = order.deliveryDate && new Date(order.deliveryDate) < new Date() && order.status !== 'delivered';

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={cn(
          'h-1.5 rounded-full cursor-pointer hover:h-2 transition-all',
        statusIndicatorMap[order.status] || 'bg-gray-300'
      )}
      title={`${order.customerName} - ${order.productName}`}
    />
  );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-all',
        'hover:shadow-sm',
        isOverdue ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800'
      )}
    >
      <div className={cn(
        'w-2 h-2 rounded-full shrink-0',
        statusIndicatorMap[order.status] || 'bg-gray-300'
      )} />
      <span className="text-xs text-gray-900 dark:text-white truncate flex-1">
        {order.customerName}
      </span>
      <span className="text-xs text-gray-500 hidden group-hover:inline">
        {formatCurrency(order.totalAmount || 0, order.currency)}
      </span>
    </div>
  );
};

// ============================================
// Day Cell
// ============================================

const DayCell: React.FC<{
  date: Date;
  orders: Order[];
  isCurrentMonth: boolean;
  onOrderClick?: (order: Order) => void;
}> = ({ date, orders, isCurrentMonth, onOrderClick }) => {
  const [showAll, setShowAll] = useState(false);
  const maxVisible = 3;
  const hasMore = orders.length > maxVisible;

  return (
    <div
      className={cn(
        'min-h-[120px] p-2 border-r border-b border-gray-200 dark:border-gray-700',
        !isCurrentMonth && 'bg-gray-50 dark:bg-gray-900/50',
        isToday(date) && 'bg-blue-50 dark:bg-blue-900/20'
      )}
    >
      {/* Date Number */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={cn(
            'text-sm font-medium',
            !isCurrentMonth && 'text-gray-400 dark:text-gray-600',
            isToday(date) && 'w-7 h-7 flex items-center justify-center bg-blue-600 text-white rounded-full'
          )}
        >
          {format(date, 'd')}
        </span>
        {orders.length > 0 && (
          <span className="text-xs text-gray-500">
            {orders.length} sipariş
          </span>
        )}
      </div>

      {/* Orders */}
      <div className="space-y-1">
        {(showAll ? orders : orders.slice(0, maxVisible)).map((order) => (
          <OrderBadge
            key={order.id}
            order={order}
            onClick={() => onOrderClick?.(order)}
          />
        ))}
        {hasMore && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            +{orders.length - maxVisible} daha
          </button>
        )}
        {showAll && hasMore && (
          <button
            onClick={() => setShowAll(false)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Daha az göster
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================
// Month View
// ============================================

const MonthView: React.FC<{
  date: Date;
  orders: Order[];
  onOrderClick?: (order: Order) => void;
}> = ({ date, orders, onOrderClick }) => {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart, { locale: tr });
  const calendarEnd = endOfWeek(monthEnd, { locale: tr });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Group orders by date
  const ordersByDate = useMemo(() => {
    const map = new Map<string, Order[]>();
    orders.forEach((order) => {
      if (order.deliveryDate) {
        const dateKey = format(parseISO(order.deliveryDate), 'yyyy-MM-dd');
        const existing = map.get(dateKey) || [];
        map.set(dateKey, [...existing, order]);
      }
    });
    return map;
  }, [orders]);

  const weekDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Week Day Headers */}
      <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {weekDays.map((day) => (
          <div
            key={day}
            className="px-2 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 text-center"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {days.map((day: Date) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayOrders = ordersByDate.get(dateKey) || [];

          return (
            <DayCell
              key={dateKey}
              date={day}
              orders={dayOrders}
              isCurrentMonth={isSameMonth(day, date)}
              onOrderClick={onOrderClick}
            />
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// Week View
// ============================================

const WeekView: React.FC<{
  date: Date;
  orders: Order[];
  onOrderClick?: (order: Order) => void;
}> = ({ date, orders, onOrderClick }) => {
  const weekStart = startOfWeek(date, { locale: tr });
  const weekEnd = endOfWeek(date, { locale: tr });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Group orders by date
  const ordersByDate = useMemo(() => {
    const map = new Map<string, Order[]>();
    orders.forEach((order) => {
      if (order.deliveryDate) {
        const dateKey = format(parseISO(order.deliveryDate), 'yyyy-MM-dd');
        const existing = map.get(dateKey) || [];
        map.set(dateKey, [...existing, order]);
      }
    });
    return map;
  }, [orders]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="grid grid-cols-7 min-h-[600px]">
        {days.map((day: Date) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayOrders = ordersByDate.get(dateKey) || [];
          const totalAmount = dayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
          const currency = dayOrders[0]?.currency || '₺';

          return (
            <div
              key={dateKey}
              className={cn(
                'border-r border-gray-200 dark:border-gray-700 last:border-r-0',
                isToday(day) && 'bg-blue-50 dark:bg-blue-900/20'
              )}
            >
              {/* Header */}
              <div className="p-3 border-b border-gray-200 dark:border-gray-700 text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {format(day, 'EEE', { locale: tr })}
                </div>
                <div
                  className={cn(
                    'text-lg font-semibold mt-1',
                    isToday(day) && 'w-8 h-8 mx-auto flex items-center justify-center bg-blue-600 text-white rounded-full'
                  )}
                >
                  {format(day, 'd')}
                </div>
                {dayOrders.length > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    {formatCurrency(totalAmount, currency)}
                  </div>
                )}
              </div>

              {/* Orders */}
              <div className="p-2 space-y-2 max-h-[500px] overflow-y-auto">
                {dayOrders.map((order) => (
                  <OrderBadge
                    key={order.id}
                    order={order}
                    onClick={() => onOrderClick?.(order)}
                  />
                ))}
                {dayOrders.length === 0 && (
                  <div className="text-center text-gray-400 text-sm py-4">
                    Sipariş yok
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// Day View
// ============================================

const DayView: React.FC<{
  date: Date;
  orders: Order[];
  onOrderClick?: (order: Order) => void;
}> = ({ date, orders, onOrderClick }) => {
  const dateKey = format(date, 'yyyy-MM-dd');
  const dayOrders = orders.filter(
    (o) => o.deliveryDate && format(parseISO(o.deliveryDate), 'yyyy-MM-dd') === dateKey
  );
  const totalAmount = dayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const currency = dayOrders[0]?.currency || '₺';

  // Group by status
  const ordersByStatus = useMemo(() => {
    const groups: Record<string, Order[]> = {
      pending: [],
      in_production: [],
      delivered: [],
    };
    dayOrders.forEach((order) => {
      if (groups[order.status]) {
        groups[order.status].push(order);
      }
    });
    return groups;
  }, [dayOrders]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 text-center">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {format(date, 'EEEE', { locale: tr })}
        </div>
        <div className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
          {format(date, 'd MMMM yyyy', { locale: tr })}
        </div>
        <div className="flex items-center justify-center gap-4 mt-4 text-sm">
          <span className="text-gray-500">{dayOrders.length} sipariş</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(totalAmount, currency)}
          </span>
        </div>
      </div>

      {/* Orders by Status */}
      <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(ordersByStatus).map(([status, statusOrders]) => {
          const statusInfo = getOrderStatusInfo(status);
          return (
            <div key={status} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={cn('w-3 h-3 rounded-full', statusIndicatorMap[status as Order['status']])} />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {statusInfo?.label}
                </span>
                <span className="text-xs text-gray-500">({statusOrders.length})</span>
              </div>
              <div className="space-y-2">
                {statusOrders.map((order) => (
                  <div
                    key={order.id}
                    onClick={() => onOrderClick?.(order)}
                    className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="font-medium text-sm text-gray-900 dark:text-white">
                      {order.customerName}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {order.productName}
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white mt-2">
                      {formatCurrency(order.totalAmount || 0, order.currency)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// Timeline View
// ============================================

const TimelineView: React.FC<{
  date: Date;
  orders: Order[];
  onOrderClick?: (order: Order) => void;
}> = ({ date, orders, onOrderClick }) => {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Group orders by date for timeline
  const timelineOrders = useMemo(() => {
    return orders
      .filter((o) => o.deliveryDate)
      .sort((a, b) => new Date(a.deliveryDate!).getTime() - new Date(b.deliveryDate!).getTime());
  }, [orders]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Timeline Header */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <div className="w-48 shrink-0 p-3 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <span className="text-sm font-medium text-gray-500">Sipariş</span>
        </div>
        <div className="flex-1 flex">
          {days.map((day: Date) => (
            <div
              key={day.toISOString()}
              className={cn(
                'flex-1 min-w-[40px] p-2 text-center border-r border-gray-200 dark:border-gray-700 text-xs',
                isToday(day) && 'bg-blue-50 dark:bg-blue-900/20'
              )}
            >
              <div className="text-gray-500">{format(day, 'd')}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline Rows */}
      <div className="max-h-[500px] overflow-y-auto">
        {timelineOrders.map((order) => {
          const orderDate = parseISO(order.deliveryDate!);
          const dayIndex = days.findIndex((d: Date) => isSameDay(d, orderDate));

          return (
            <div
              key={order.id}
              className="flex border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <div
                onClick={() => onOrderClick?.(order)}
                className="w-48 shrink-0 p-3 border-r border-gray-200 dark:border-gray-700 cursor-pointer"
              >
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {order.customerName}
                </div>
                <div className="text-xs text-gray-500 truncate">{order.productName}</div>
              </div>
              <div className="flex-1 flex relative">
                {days.map((day: Date, idx: number) => (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'flex-1 min-w-[40px] border-r border-gray-100 dark:border-gray-800',
                      isToday(day) && 'bg-blue-50/50 dark:bg-blue-900/10'
                    )}
                  />
                ))}
                {/* Order Bar */}
                {dayIndex >= 0 && (
                  <div
                    className={cn(
                      'absolute top-1/2 -translate-y-1/2 h-6 rounded-full',
                      statusIndicatorMap[order.status] || 'bg-gray-300'
                    )}
                    style={{
                      left: `calc(${(dayIndex / days.length) * 100}% + 4px)`,
                      width: '32px',
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// Main Calendar View
// ============================================

export const CalendarView: React.FC<CalendarViewProps> = ({
  orders,
  onOrderClick,
  onDateChange,
}) => {
  const { calendarView, calendarDate, setCalendarView, setCalendarDate } = useOrdersStore();

  // Navigation handlers
  const handlePrev = () => {
    switch (calendarView) {
      case 'month':
        setCalendarDate(subMonths(calendarDate, 1));
        break;
      case 'week':
        setCalendarDate(subWeeks(calendarDate, 1));
        break;
      case 'day':
        setCalendarDate(subDays(calendarDate, 1));
        break;
      case 'timeline':
        setCalendarDate(subMonths(calendarDate, 1));
        break;
    }
  };

  const handleNext = () => {
    switch (calendarView) {
      case 'month':
        setCalendarDate(addMonths(calendarDate, 1));
        break;
      case 'week':
        setCalendarDate(addWeeks(calendarDate, 1));
        break;
      case 'day':
        setCalendarDate(addDays(calendarDate, 1));
        break;
      case 'timeline':
        setCalendarDate(addMonths(calendarDate, 1));
        break;
    }
  };

  const handleToday = () => {
    setCalendarDate(new Date());
  };

  // Get title based on view
  const getTitle = () => {
    switch (calendarView) {
      case 'month':
        return format(calendarDate, 'MMMM yyyy', { locale: tr });
      case 'week':
        const weekStart = startOfWeek(calendarDate, { locale: tr });
        const weekEnd = endOfWeek(calendarDate, { locale: tr });
        return `${format(weekStart, 'd MMM', { locale: tr })} - ${format(weekEnd, 'd MMM yyyy', { locale: tr })}`;
      case 'day':
        return format(calendarDate, 'd MMMM yyyy', { locale: tr });
      case 'timeline':
        return format(calendarDate, 'MMMM yyyy', { locale: tr });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {getTitle()}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              Bugün
            </button>
            <button
              onClick={handleNext}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {(['month', 'week', 'day', 'timeline'] as CalendarViewMode[]).map((view) => (
            <button
              key={view}
              onClick={() => setCalendarView(view)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                calendarView === view
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              {view === 'month' && 'Ay'}
              {view === 'week' && 'Hafta'}
              {view === 'day' && 'Gün'}
              {view === 'timeline' && 'Timeline'}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={calendarView}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          {calendarView === 'month' && (
            <MonthView date={calendarDate} orders={orders} onOrderClick={onOrderClick} />
          )}
          {calendarView === 'week' && (
            <WeekView date={calendarDate} orders={orders} onOrderClick={onOrderClick} />
          )}
          {calendarView === 'day' && (
            <DayView date={calendarDate} orders={orders} onOrderClick={onOrderClick} />
          )}
          {calendarView === 'timeline' && (
            <TimelineView date={calendarDate} orders={orders} onOrderClick={onOrderClick} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default CalendarView;
