'use client';

/**
 * Enterprise Advanced Filters Component
 * Collapsible filter panel with date range, type, and method filters
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  Filter, 
  ChevronDown, 
  X, 
  Calendar,
  Search,
  RefreshCw,
  Download,
} from 'lucide-react';
import { PAYMENT_METHOD_LABELS, DOCUMENT_TYPE_LABELS, LEDGER_KIND_LABELS } from '@/lib/types/finance';

// ============================================
// Types
// ============================================

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'date' | 'dateRange' | 'search' | 'multiSelect';
  options?: FilterOption[];
  placeholder?: string;
}

export interface FilterValues {
  [key: string]: string | string[] | undefined;
}

export interface AdvancedFiltersProps {
  filters: FilterConfig[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onReset?: () => void;
  onExport?: () => void;
  onRefresh?: () => void;
  isExporting?: boolean;
  isRefreshing?: boolean;
  activeCount?: number;
  className?: string;
  defaultExpanded?: boolean;
}

// ============================================
// Predefined Filter Options
// ============================================

export const PAYMENT_METHOD_OPTIONS: FilterOption[] = Object.entries(PAYMENT_METHOD_LABELS).map(
  ([value, label]) => ({ value, label })
);

export const DOCUMENT_TYPE_OPTIONS: FilterOption[] = Object.entries(DOCUMENT_TYPE_LABELS).map(
  ([value, label]) => ({ value, label })
);

export const LEDGER_KIND_OPTIONS: FilterOption[] = Object.entries(LEDGER_KIND_LABELS).map(
  ([value, label]) => ({ value, label })
);

export const DATE_RANGE_PRESETS: FilterOption[] = [
  { value: 'today', label: 'Bugün' },
  { value: 'yesterday', label: 'Dün' },
  { value: 'last7days', label: 'Son 7 Gün' },
  { value: 'last30days', label: 'Son 30 Gün' },
  { value: 'thisMonth', label: 'Bu Ay' },
  { value: 'lastMonth', label: 'Geçen Ay' },
  { value: 'thisQuarter', label: 'Bu Çeyrek' },
  { value: 'thisYear', label: 'Bu Yıl' },
  { value: 'custom', label: 'Özel Tarih' },
];

// ============================================
// Main Component
// ============================================

export function AdvancedFilters({
  filters,
  values,
  onChange,
  onReset,
  onExport,
  onRefresh,
  isExporting = false,
  isRefreshing = false,
  activeCount = 0,
  className,
  defaultExpanded = false,
}: AdvancedFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleChange = useCallback((key: string, value: string | string[] | undefined) => {
    onChange({ ...values, [key]: value });
  }, [values, onChange]);

  const handleReset = useCallback(() => {
    const resetValues: FilterValues = {};
    filters.forEach(f => {
      resetValues[f.key] = undefined;
    });
    onChange(resetValues);
    onReset?.();
  }, [filters, onChange, onReset]);

  // Count active filters
  const countActiveFilters = () => {
    return Object.values(values).filter(v => v !== undefined && v !== '' && (!Array.isArray(v) || v.length > 0)).length;
  };

  const activeFiltersCount = activeCount || countActiveFilters();

  return (
    <div className={cn(
      'bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden',
      className
    )}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Filter size={18} className="text-slate-500" />
          <span className="font-medium text-slate-900 dark:text-white">Filtreler</span>
          {activeFiltersCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
              {activeFiltersCount} aktif
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Quick Actions */}
          {onRefresh && (
            <button
              type="button"
              onClick={(e: React.MouseEvent<HTMLElement>) => { e.stopPropagation(); onRefresh(); }}
              disabled={isRefreshing}
              className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
              title="Yenile"
            >
              <RefreshCw size={16} className={cn(isRefreshing && 'animate-spin')} />
            </button>
          )}
          
          {onExport && (
            <button
              type="button"
              onClick={(e: React.MouseEvent<HTMLElement>) => { e.stopPropagation(); onExport(); }}
              disabled={isExporting}
              className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
              title="Dışa Aktar"
            >
              <Download size={16} className={cn(isExporting && 'animate-pulse')} />
            </button>
          )}
          
          <ChevronDown 
            size={18} 
            className={cn(
              'text-slate-400 transition-transform',
              isExpanded && 'rotate-180'
            )} 
          />
        </div>
      </button>

      {/* Filter Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-800">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
                {filters.map((filter) => (
                  <FilterField
                    key={filter.key}
                    config={filter}
                    value={values[filter.key]}
                    onChange={(value) => handleChange(filter.key, value)}
                  />
                ))}
              </div>
              
              {/* Actions */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
                >
                  <X size={14} />
                  Filtreleri Temizle
                </button>
                
                <p className="text-xs text-slate-400">
                  {activeFiltersCount > 0 
                    ? `${activeFiltersCount} filtre uygulandı`
                    : 'Filtre uygulanmadı'
                  }
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Filter Field Component
// ============================================

interface FilterFieldProps {
  config: FilterConfig;
  value: string | string[] | undefined;
  onChange: (value: string | string[] | undefined) => void;
}

function FilterField({ config, value, onChange }: FilterFieldProps) {
  switch (config.type) {
    case 'select':
      return (
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            {config.label}
          </label>
          <select
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">{config.placeholder || 'Tümü'}</option>
            {config.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );

    case 'search':
      return (
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            {config.label}
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={(value as string) || ''}
              onChange={(e) => onChange(e.target.value || undefined)}
              placeholder={config.placeholder || 'Ara...'}
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      );

    case 'date':
      return (
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            {config.label}
          </label>
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              value={(value as string) || ''}
              onChange={(e) => onChange(e.target.value || undefined)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      );

    case 'dateRange':
      const [startDate, endDate] = Array.isArray(value) ? value : ['', ''];
      return (
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            {config.label}
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => onChange([e.target.value, endDate])}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <span className="text-slate-400">-</span>
            <div className="relative flex-1">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => onChange([startDate, e.target.value])}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      );

    case 'multiSelect':
      const selectedValues = Array.isArray(value) ? value : [];
      return (
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            {config.label}
          </label>
          <div className="flex flex-wrap gap-1">
            {config.options?.map((opt) => {
              const isSelected = selectedValues.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      onChange(selectedValues.filter(v => v !== opt.value));
                    } else {
                      onChange([...selectedValues, opt.value]);
                    }
                  }}
                  className={cn(
                    'px-2 py-1 text-xs rounded-full border transition-colors',
                    isSelected
                      ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                      : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 hover:border-slate-300'
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      );

    default:
      return null;
  }
}

// ============================================
// Quick Filter Bar (inline version)
// ============================================

interface QuickFilterBarProps {
  filters: { key: string; label: string; value: string | undefined; options: FilterOption[] }[];
  onFilterChange: (key: string, value: string | undefined) => void;
  onSearch?: (term: string) => void;
  searchValue?: string;
  searchPlaceholder?: string;
  className?: string;
}

export function QuickFilterBar({
  filters,
  onFilterChange,
  onSearch,
  searchValue = '',
  searchPlaceholder = 'Ara...',
  className,
}: QuickFilterBarProps) {
  return (
    <div className={cn(
      'flex flex-wrap items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800',
      className
    )}>
      {onSearch && (
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}
      
      {filters.map((filter) => (
        <select
          key={filter.key}
          value={filter.value || ''}
          onChange={(e) => onFilterChange(filter.key, e.target.value || undefined)}
          className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">{filter.label}</option>
          {filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}
