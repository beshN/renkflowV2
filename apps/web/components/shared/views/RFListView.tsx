'use client';

import { ReactNode, useState, useMemo } from 'react';
import { Search, Filter, SlidersHorizontal, Download, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

export interface RFColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T) => ReactNode;
}

export interface RFFilter {
  key: string;
  label: string;
  type: 'select' | 'text' | 'date';
  options?: { value: string; label: string }[];
}

export interface RFListViewProps<T extends { id: string }> {
  title: string;
  subtitle?: string;
  data: T[];
  columns: RFColumn<T>[];
  filters?: RFFilter[];
  isLoading?: boolean;
  totalCount?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onSearch?: (query: string) => void;
  onRowClick?: (row: T) => void;
  onRowSelect?: (selected: T[]) => void;
  primaryAction?: {
    label: string;
    icon?: ReactNode;
    onClick: () => void;
  };
  secondaryActions?: {
    label: string;
    icon?: ReactNode;
    onClick: (selected: T[]) => void;
  }[];
  emptyState?: {
    title: string;
    description: string;
    action?: { label: string; onClick: () => void };
  };
  selectedRows?: T[];
  onFilterChange?: (key: string, value: string) => void;
  filterValues?: Record<string, string>;
}

// ============================================
// Loading Skeleton
// ============================================

function TableSkeleton({ cols, rows = 8 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800">
          {Array.from({ length: cols + 1 }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div
                className="h-4 rounded-md bg-neutral-200 dark:bg-neutral-800 animate-pulse"
                style={{ width: j === 0 ? '20px' : `${60 + Math.random() * 30}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ============================================
// RFListView Component
// ============================================

export function RFListView<T extends { id: string }>({
  title,
  subtitle,
  data,
  columns,
  filters = [],
  isLoading = false,
  totalCount,
  page = 1,
  pageSize = 25,
  onPageChange,
  onSearch,
  onRowClick,
  onRowSelect,
  primaryAction,
  secondaryActions = [],
  emptyState,
  selectedRows = [],
  onFilterChange,
  filterValues = {},
}: RFListViewProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set());

  const effectiveTotal = totalCount ?? data.length;
  const totalPages = Math.ceil(effectiveTotal / pageSize);
  const allSelected = data.length > 0 && data.every((row) => localSelected.has(row.id));

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  const handleSelectAll = () => {
    if (allSelected) {
      setLocalSelected(new Set());
      onRowSelect?.([]);
    } else {
      const newSelected = new Set(data.map((r) => r.id));
      setLocalSelected(newSelected);
      onRowSelect?.(data);
    }
  };

  const handleSelectRow = (row: T, checked: boolean) => {
    const next = new Set(localSelected);
    if (checked) {
      next.add(row.id);
    } else {
      next.delete(row.id);
    }
    setLocalSelected(next);
    onRowSelect?.(data.filter((r) => next.has(r.id)));
  };

  const selectedCount = localSelected.size;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedCount > 0 && secondaryActions.map((action) => (
            <button
              key={action.label}
              onClick={() => action.onClick(data.filter((r) => localSelected.has(r.id)))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3.5 py-2 text-sm font-medium text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              {action.icon}
              {action.label}
              <span className="ml-1 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-xs font-semibold">
                {selectedCount}
              </span>
            </button>
          ))}
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all"
            >
              {primaryAction.icon || <Plus size={16} />}
              {primaryAction.label}
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Ara..."
            className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* Filter Toggle */}
        {filters.length > 0 && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors',
              showFilters
                ? 'border-primary bg-primary/5 text-primary dark:bg-primary/10'
                : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-muted-foreground hover:text-foreground'
            )}
          >
            <SlidersHorizontal size={15} />
            Filtrele
            {Object.values(filterValues).filter(Boolean).length > 0 && (
              <span className="ml-0.5 rounded-full bg-primary text-white px-1.5 text-xs">
                {Object.values(filterValues).filter(Boolean).length}
              </span>
            )}
          </button>
        )}

        {/* Count */}
        <span className="text-sm text-muted-foreground ml-auto whitespace-nowrap">
          {isLoading ? '...' : `${effectiveTotal} kayıt`}
        </span>
      </div>

      {/* Filter Bar */}
      {showFilters && filters.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50">
          {filters.map((filter) => (
            <div key={filter.key} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">{filter.label}</label>
              {filter.type === 'select' ? (
                <select
                  value={filterValues[filter.key] || ''}
                  onChange={(e) => onFilterChange?.(filter.key, e.target.value)}
                  className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary transition-colors min-w-[140px]"
                >
                  <option value="">Tümü</option>
                  {filter.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={filter.type}
                  value={filterValues[filter.key] || ''}
                  onChange={(e) => onFilterChange?.(filter.key, e.target.value)}
                  className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary transition-colors"
                  placeholder={filter.label}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-sm">
        <div className="overflow-x-auto h-full">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-neutral-50/90 dark:bg-neutral-900/90 backdrop-blur-sm">
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                {onRowSelect && (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleSelectAll}
                      className="rounded border-neutral-300 text-primary focus:ring-primary/20"
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground',
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                      col.width
                    )}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {isLoading ? (
                <TableSkeleton cols={columns.length} />
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (onRowSelect ? 1 : 0)} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                        <Search size={20} className="text-muted-foreground/50" />
                      </div>
                      <p className="font-semibold text-foreground">
                        {emptyState?.title || 'Kayıt bulunamadı'}
                      </p>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        {emptyState?.description || 'Arama kriterlerinize uygun kayıt yok.'}
                      </p>
                      {emptyState?.action && (
                        <button
                          onClick={emptyState.action.onClick}
                          className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
                        >
                          {emptyState.action.label}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'group transition-colors',
                      onRowClick ? 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/50' : '',
                      localSelected.has(row.id) ? 'bg-primary/5 dark:bg-primary/10' : ''
                    )}
                  >
                    {onRowSelect && (
                      <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={localSelected.has(row.id)}
                          onChange={(e) => handleSelectRow(row, e.target.checked)}
                          className="rounded border-neutral-300 text-primary focus:ring-primary/20"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-4 py-3',
                          col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                        )}
                      >
                        {col.render
                          ? col.render((row as any)[col.key], row)
                          : (
                            <span className="text-foreground">
                              {(row as any)[col.key] ?? '—'}
                            </span>
                          )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-sm text-muted-foreground">
            {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, effectiveTotal)} / {effectiveTotal} kayıt
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-muted-foreground hover:text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange?.(pageNum)}
                  className={cn(
                    'w-9 h-9 rounded-lg text-sm font-medium transition-colors',
                    pageNum === page
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'border border-neutral-200 dark:border-neutral-700 text-muted-foreground hover:text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-900'
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-muted-foreground hover:text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
