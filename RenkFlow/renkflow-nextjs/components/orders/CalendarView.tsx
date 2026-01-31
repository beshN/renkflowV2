'use client';

import { useState } from 'react';
import { Order } from '@/lib/types';
import { formatDate, getOrderStatusInfo } from '@/lib/utils';
import Link from 'next/link';

interface CalendarViewProps {
  orders: Order[];
}

export function CalendarView({ orders }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Get calendar grid for current month
  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday

    const days: (Date | null)[] = [];
    
    // Add empty slots for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  // Get orders for a specific date
  const getOrdersForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return orders.filter(order => {
      const orderDate = order.deliveryDate || order.date;
      return orderDate.startsWith(dateStr);
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const calendarDays = getCalendarDays();
  const monthName = currentDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  const weekDays = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

  return (
    <div className="bg-card-light dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
      {/* Calendar Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-light dark:border-border-dark bg-background-light/50 dark:bg-background-dark/50">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-1.5 hover:bg-card-light dark:hover:bg-card-dark rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">chevron_left</span>
        </button>
        
        <h3 className="text-base font-semibold text-text-light dark:text-text-dark capitalize">
          {monthName}
        </h3>
        
        <button
          onClick={() => navigateMonth('next')}
          className="p-1.5 hover:bg-card-light dark:hover:bg-card-dark rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">chevron_right</span>
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="p-3">
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekDays.map(day => (
            <div
              key={day}
              className="text-center text-xs font-semibold text-subtle-light dark:text-subtle-dark py-1"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            if (!day) {
              return <div key={`empty-${currentDate.getMonth()}-${index}`} className="h-20" />;
            }

            const dayOrders = getOrdersForDate(day);
            const isToday = day.toDateString() === new Date().toDateString();

            return (
              <div
                key={`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
                className={`
                  h-20 border rounded-md p-1.5 transition-all hover:border-primary/50 overflow-hidden
                  ${isToday 
                    ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-primary/20' 
                    : 'border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark'
                  }
                `}
              >
                <div className="flex flex-col h-full">
                  <div className={`text-xs font-medium mb-0.5 ${isToday ? 'text-primary' : 'text-text-light dark:text-text-dark'}`}>
                    {day.getDate()}
                  </div>
                  
                  {dayOrders.length > 0 && (
                    <div className="flex-1 overflow-hidden space-y-0.5">
                      {dayOrders.slice(0, 2).map((order) => {
                        const statusInfo = getOrderStatusInfo(order.status);
                        return (
                          <Link
                            key={order.id}
                            href={`/orders/${order.id}`}
                            className="block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div
                              className={`text-[10px] px-1.5 py-0.5 rounded truncate ${statusInfo.className} hover:opacity-80 transition-opacity leading-tight`}
                              title={`${order.customerName} - ${order.productName || 'Sipariş'}`}
                            >
                              #{order.id.slice(0, 4)}
                            </div>
                          </Link>
                        );
                      })}
                      
                      {dayOrders.length > 2 && (
                        <div className="text-[9px] text-subtle-light dark:text-subtle-dark px-1.5 truncate">
                          +{dayOrders.length - 2}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-4 py-2 border-t border-border-light dark:border-border-dark bg-background-light/50 dark:bg-background-dark/50 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-yellow-500/20 border border-yellow-500/50"></div>
          <span className="text-[11px] text-subtle-light dark:text-subtle-dark">Beklemede</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-blue-500/20 border border-blue-500/50"></div>
          <span className="text-[11px] text-subtle-light dark:text-subtle-dark">Üretimde</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-green-500/20 border border-green-500/50"></div>
          <span className="text-[11px] text-subtle-light dark:text-subtle-dark">Teslim Edildi</span>
        </div>
      </div>
    </div>
  );
}
