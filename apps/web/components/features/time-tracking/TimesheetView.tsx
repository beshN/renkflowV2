'use client';

/**
 * Timesheet View Component
 * Weekly/monthly timesheet with entries and summaries
 */

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTimeTrackingStore } from '@/lib/stores/timeTracking.store';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Plus,
  Download,
  Filter,
  MoreHorizontal,
  Edit2,
  Trash2,
  DollarSign,
  Check,
  X,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface TimesheetViewProps {
  onAddEntry?: (date: string) => void;
  onEditEntry?: (entryId: string) => void;
  onDeleteEntry?: (entryId: string) => void;
}

// ============================================
// Constants
// ============================================

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const WEEKDAYS_FULL = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

// ============================================
// Helper Functions
// ============================================

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}s ${minutes}dk`;
}

function formatHours(seconds: number): string {
  const hours = seconds / 3600;
  return hours.toFixed(1) + 's';
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
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

// ============================================
// Week Header
// ============================================

function WeekHeader({
  weekStart,
  onPrevious,
  onNext,
  onToday,
}: {
  weekStart: Date;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const weekEnd = addDays(weekStart, 6);
  const monthYear = weekStart.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return (
    <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-4">
        <button
          onClick={onToday}
          className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
        >
          Bu Hafta
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={onPrevious}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <ChevronLeft size={20} className="text-slate-600 dark:text-slate-400" />
          </button>
          <button
            onClick={onNext}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <ChevronRight size={20} className="text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{monthYear}</h2>
          <p className="text-sm text-slate-500">
            {weekStart.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} -{' '}
            {weekEnd.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
          <Filter size={16} />
          Filtre
        </button>
        <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
          <Download size={16} />
          Dışa Aktar
        </button>
      </div>
    </div>
  );
}

// ============================================
// Day Column
// ============================================

function DayColumn({
  date,
  entries,
  targetHours,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
}: {
  date: Date;
  entries: any[];
  targetHours: number;
  onAddEntry?: (date: string) => void;
  onEditEntry?: (entryId: string) => void;
  onDeleteEntry?: (entryId: string) => void;
}) {
  const totalSeconds = entries.reduce((sum, e) => sum + e.duration, 0);
  const totalHours = totalSeconds / 3600;
  const progress = Math.min(100, (totalHours / targetHours) * 100);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;

  return (
    <div
      className={cn(
        'flex flex-col border-r border-slate-200 dark:border-slate-700 last:border-r-0',
        isWeekend && 'bg-slate-50 dark:bg-slate-800/30'
      )}
    >
      {/* Day Header */}
      <div
        className={cn(
          'p-3 border-b border-slate-200 dark:border-slate-700 text-center',
          isToday(date) && 'bg-blue-50 dark:bg-blue-900/20'
        )}
      >
        <div className="text-xs text-slate-500 uppercase">{WEEKDAYS[dayIndex]}</div>
        <div
          className={cn(
            'text-lg font-semibold',
            isToday(date) ? 'text-blue-600' : 'text-slate-900 dark:text-white'
          )}
        >
          {date.getDate()}
        </div>
      </div>

      {/* Hours Summary */}
      <div className="p-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500">{formatHours(totalSeconds)}</span>
          <span className="text-xs text-slate-400">/ {targetHours}s</span>
        </div>
        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              progress >= 100
                ? 'bg-green-500'
                : progress >= 75
                ? 'bg-blue-500'
                : progress >= 50
                ? 'bg-amber-500'
                : 'bg-slate-400'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Entries */}
      <div className="flex-1 p-2 space-y-1 overflow-auto min-h-[200px]">
        {entries.map((entry) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer"
            onClick={() => onEditEntry?.(entry.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                  {entry.description || 'Açıklama yok'}
                </p>
                <p className="text-xs text-slate-500">{formatDuration(entry.duration)}</p>
              </div>
              {entry.billable && (
                <DollarSign size={12} className="text-green-500 flex-shrink-0" />
              )}
            </div>

            {/* Hover Actions */}
            <div className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
              <button
                onClick={(e: React.MouseEvent<HTMLElement>) => {
                  e.stopPropagation();
                  onEditEntry?.(entry.id);
                }}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
              >
                <Edit2 size={10} className="text-slate-400" />
              </button>
              <button
                onClick={(e: React.MouseEvent<HTMLElement>) => {
                  e.stopPropagation();
                  onDeleteEntry?.(entry.id);
                }}
                className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
              >
                <Trash2 size={10} className="text-red-400" />
              </button>
            </div>
          </motion.div>
        ))}

        {/* Add Entry Button */}
        <button
          onClick={() => onAddEntry?.(date.toISOString().split('T')[0])}
          className="w-full p-2 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center gap-1"
        >
          <Plus size={12} />
          Ekle
        </button>
      </div>
    </div>
  );
}

// ============================================
// Weekly Summary
// ============================================

function WeeklySummary({
  totalHours,
  billableHours,
  targetHours,
  overtimeHours,
}: {
  totalHours: number;
  billableHours: number;
  targetHours: number;
  overtimeHours: number;
}) {
  const utilization = targetHours > 0 ? (totalHours / targetHours) * 100 : 0;
  const billableRate = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;

  return (
    <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
      <div className="grid grid-cols-4 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {totalHours.toFixed(1)}s
          </p>
          <p className="text-xs text-slate-500">Toplam Saat</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">{billableHours.toFixed(1)}s</p>
          <p className="text-xs text-slate-500">Faturalanabilir</p>
        </div>
        <div className="text-center">
          <p
            className={cn(
              'text-2xl font-bold',
              utilization >= 100
                ? 'text-green-600'
                : utilization >= 80
                ? 'text-blue-600'
                : 'text-amber-600'
            )}
          >
            {utilization.toFixed(0)}%
          </p>
          <p className="text-xs text-slate-500">Kullanım</p>
        </div>
        <div className="text-center">
          <p
            className={cn(
              'text-2xl font-bold',
              overtimeHours > 0 ? 'text-red-600' : 'text-slate-400'
            )}
          >
            {overtimeHours > 0 ? `+${overtimeHours.toFixed(1)}s` : '0s'}
          </p>
          <p className="text-xs text-slate-500">Fazla Mesai</p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Timesheet View
// ============================================

export function TimesheetView({
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
}: TimesheetViewProps) {
  const { entries, getWeeklyTimesheet } = useTimeTrackingStore();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));

  // Get week data
  const weekData = useMemo(() => {
    return getWeeklyTimesheet(weekStart);
  }, [weekStart, getWeeklyTimesheet]);

  // Navigation handlers
  const goToPreviousWeek = useCallback(() => {
    setWeekStart((prev) => addDays(prev, -7));
  }, []);

  const goToNextWeek = useCallback(() => {
    setWeekStart((prev) => addDays(prev, 7));
  }, []);

  const goToThisWeek = useCallback(() => {
    setWeekStart(getWeekStart(new Date()));
  }, []);

  // Generate week days
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  // Get entries for each day
  const getEntriesForDay = useCallback(
    (date: Date) => {
      return entries.filter((e) => {
        const entryDate = new Date(e.startTime);
        return isSameDay(entryDate, date);
      });
    },
    [entries]
  );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Header */}
      <WeekHeader
        weekStart={weekStart}
        onPrevious={goToPreviousWeek}
        onNext={goToNextWeek}
        onToday={goToThisWeek}
      />

      {/* Week Grid */}
      <div className="flex-1 grid grid-cols-7 overflow-hidden">
        {weekDays.map((date, index) => (
          <DayColumn
            key={index}
            date={date}
            entries={getEntriesForDay(date)}
            targetHours={index < 5 ? 8 : 0} // 8 hours for weekdays
            onAddEntry={onAddEntry}
            onEditEntry={onEditEntry}
            onDeleteEntry={onDeleteEntry}
          />
        ))}
      </div>

      {/* Summary */}
      <WeeklySummary
        totalHours={weekData.totalHours}
        billableHours={weekData.billableHours}
        targetHours={weekData.targetHours}
        overtimeHours={weekData.overtimeHours}
      />
    </div>
  );
}
