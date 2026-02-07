'use client';

import React from 'react';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  eachDayOfInterval,
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CalendarProps {
  mode?: 'single';
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  initialFocus?: boolean;
  className?: string;
}

export function Calendar({
  mode: _mode,
  selected,
  onSelect,
  initialFocus,
  className,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState<Date>(selected || new Date());
  const gridRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (initialFocus) {
      gridRef.current?.focus();
    }
  }, [initialFocus]);

  React.useEffect(() => {
    if (selected) {
      setCurrentMonth(selected);
    }
  }, [selected]);

  const start = startOfWeek(startOfMonth(currentMonth), { locale: tr });
  const end = endOfWeek(endOfMonth(currentMonth), { locale: tr });
  const days = eachDayOfInterval({ start, end });

  return (
    <div className={cn('p-4 w-72', className)}>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
          className="min-touch rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 px-2"
          aria-label="Önceki ay"
        >
          ‹
        </button>
        <div className="text-sm font-semibold text-gray-900 dark:text-white">
          {format(currentMonth, 'MMMM yyyy', { locale: tr })}
        </div>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="min-touch rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 px-2"
          aria-label="Sonraki ay"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 text-xs text-gray-500 mb-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="text-center">
            {format(addDays(start, i), 'EEEEE', { locale: tr })}
          </div>
        ))}
      </div>

      <div
        ref={gridRef}
        tabIndex={-1}
        className="grid grid-cols-7 gap-1"
        aria-label="Takvim"
      >
        {days.map((day) => {
          const isOutside = !isSameMonth(day, currentMonth);
          const isSelected = selected ? isSameDay(day, selected) : false;
          const isTodayDate = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelect?.(day)}
              className={cn(
                'min-touch rounded-lg text-xs font-medium transition-colors',
                isOutside && 'text-gray-300 dark:text-gray-600',
                isSelected && 'bg-blue-600 text-white',
                !isSelected && 'hover:bg-gray-100 dark:hover:bg-gray-800',
                isTodayDate && !isSelected && 'border border-blue-300 text-blue-600'
              )}
              aria-selected={isSelected}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
