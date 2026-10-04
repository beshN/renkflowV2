'use client';

import { ReactNode, useState, useMemo, useId } from 'react';
import { Search, SlidersHorizontal, Plus, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, X, TriangleAlert } from 'lucide-react';
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
  description?: string;
  icon?: ReactNode;
  data: T[];
  columns: RFColumn<T>[];
  filters?: RFFilter[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  searchValue?: string;
  hideHeader?: boolean;
  totalCount?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onSearch?: (query: string) => void;
  searchKeys?: string[];
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
    requiresSelection?: boolean;
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
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div
                className="h-4 rounded-md bg-neutral-200 dark:bg-neutral-800 animate-pulse"
                style={{ width: j === 0 ? '20px' : '75%' }}
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
  description,
  icon,
  data,
  columns,
  filters = [],
  isLoading = false,
  error,
  onRetry,
  searchValue,
  hideHeader = false,
  totalCount,
  page = 1,
  pageSize = 25,
  onPageChange,
  onSearch,
  searchKeys,
  onRowClick,
  onRowSelect,
  primaryAction,
  secondaryActions = [],
  emptyState,
  selectedRows,
  onFilterChange,
  filterValues = {},
}: RFListViewProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set());
  const [localPage, setLocalPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const filterId = useId();
  const queryValue = searchValue ?? searchQuery;
  const selectedIds = selectedRows ? new Set(selectedRows.map(row => row.id)) : localSelected;
  const presentSelected = new Set(data.filter(row => selectedIds.has(row.id)).map(row => row.id));
  const currentPage = onPageChange ? page : localPage;
  const filteredData = useMemo(() => {
    const query = queryValue.trim().toLocaleLowerCase('tr-TR');
    const keys = searchKeys || columns.map(column => column.key);
    const result = onSearch || !query ? [...data] : data.filter(row => keys.some(key => String((row as Record<string, unknown>)[key] ?? '').toLocaleLowerCase('tr-TR').includes(query)));
    if (sort) result.sort((a, b) => {
      const first = (a as Record<string, unknown>)[sort.key];
      const second = (b as Record<string, unknown>)[sort.key];
      const comparison = typeof first === 'number' && typeof second === 'number' ? first - second : String(first ?? '').localeCompare(String(second ?? ''), 'tr', { numeric: true });
      return sort.direction === 'asc' ? comparison : -comparison;
    });
    return result;
  }, [data, onSearch, queryValue, searchKeys, columns, sort]);

  const effectiveTotal = onPageChange ? totalCount ?? filteredData.length : filteredData.length;
  const totalPages = Math.ceil(effectiveTotal / pageSize);
  const safePage = Math.max(1, Math.min(currentPage, totalPages || 1));
  const visibleData = onPageChange ? filteredData : filteredData.slice((safePage - 1) * pageSize, safePage * pageSize);
  const allSelected = visibleData.length > 0 && visibleData.every((row) => presentSelected.has(row.id));
  const changePage = (next: number) => onPageChange ? onPageChange(next) : setLocalPage(next);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setLocalPage(1);
    onSearch?.(value);
  };

  const handleSelectAll = () => {
    const next = new Set(presentSelected);
    visibleData.forEach(row => allSelected ? next.delete(row.id) : next.add(row.id));
    setLocalSelected(next);
    onRowSelect?.(data.filter(row => next.has(row.id)));
  };

  const handleSelectRow = (row: T, checked: boolean) => {
    const next = new Set(presentSelected);
    if (checked) {
      next.add(row.id);
    } else {
      next.delete(row.id);
    }
    setLocalSelected(next);
    onRowSelect?.(data.filter((r) => next.has(r.id)));
  };

  const selectedCount = presentSelected.size;

  return (
    <div className="rf-data-view flex flex-col h-full">
      {/* Header */}
      {!hideHeader && <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            {icon}
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          </div>
          {(subtitle || description) && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle || description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {secondaryActions.filter(action => action.requiresSelection === false || selectedCount > 0).map((action) => (
            <button
              key={action.label}
              disabled={isLoading}
              onClick={() => action.onClick(data.filter((r) => presentSelected.has(r.id)))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3.5 py-2 text-sm font-medium text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              {action.icon}
              {action.label}
              {action.requiresSelection !== false && <span className="ml-1 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-xs font-semibold">
                {selectedCount}
              </span>}
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
      </div>}

      {error && <div role="alert" className="rf-alert mb-4"><TriangleAlert size={18} className="shrink-0" /><div className="flex-1 text-xs"><p className="font-medium">{error}</p>{data.length > 0 && <p className="mt-1">Son alınan kayıtlar gösteriliyor.</p>}</div>{onRetry && <button type="button" onClick={onRetry} className="text-xs font-medium underline underline-offset-2">Tekrar dene</button>}</div>}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={queryValue}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Kayıtlarda ara…"
            aria-label={title + ' içinde ara'}
            className="w-full rounded-md border border-border bg-card py-2.5 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors"
          />
          {queryValue && <button type="button" aria-label="Aramayı temizle" onClick={() => handleSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"><X size={14} /></button>}
        </div>

        {/* Filter Toggle */}
        {filters.length > 0 && (
          <button
            type="button"
            aria-expanded={showFilters}
            aria-controls={filterId}
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
        <div id={filterId} className="flex flex-wrap gap-3 mb-4 p-4 rounded-lg border border-border bg-accent/40">
          {filters.map((filter) => (
            <div key={filter.key} className="flex flex-col gap-1">
              <label htmlFor={filterId + filter.key} className="text-xs font-medium text-muted-foreground">{filter.label}</label>
              {filter.type === 'select' ? (
                <select
                  id={filterId + filter.key}
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
                  id={filterId + filter.key}
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
      <div className="rf-table-container flex-1 overflow-hidden rounded-lg border border-border bg-card shadow-sm" aria-busy={isLoading}>
        <div className="overflow-x-auto h-full">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-neutral-50/90 dark:bg-neutral-900/90 backdrop-blur-sm">
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                {onRowSelect && (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Bu sayfadaki tüm kayıtları seç"
                      checked={allSelected}
                      onChange={handleSelectAll}
                      className="rounded border-neutral-300 text-primary focus:ring-primary/20"
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={col.sortable ? sort?.key === col.key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none' : undefined}
                    className={cn(
                      'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground',
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                      col.width
                    )}
                  >
                    {col.sortable ? <button type="button" onClick={() => { setSort({ key: col.key, direction: sort?.key === col.key && sort.direction === 'asc' ? 'desc' : 'asc' }); setLocalPage(1); }} className="inline-flex items-center gap-1.5 uppercase tracking-wider">{col.label}{sort?.key === col.key ? sort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ArrowUpDown size={12} className="opacity-40" />}</button> : col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {isLoading ? (
                <TableSkeleton cols={columns.length + (onRowSelect ? 1 : 0)} />
              ) : visibleData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (onRowSelect ? 1 : 0)} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                        <Search size={20} className="text-muted-foreground/50" />
                      </div>
                      <p className="font-semibold text-foreground">
                        {error ? 'Kayıtlar yüklenemedi' : emptyState?.title || 'Kayıt bulunamadı'}
                      </p>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        {error ? 'Tekrar deneyin veya bağlantınızı kontrol edin.' : emptyState?.description || 'Arama kriterlerinize uygun kayıt yok.'}
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
                visibleData.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick?.(row)}
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onRowClick?.(row); } }}
                    className={cn(
                      'group transition-colors',
                      onRowClick ? 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/50' : '',
                      presentSelected.has(row.id) ? 'bg-primary/5 dark:bg-primary/10' : ''
                    )}
                  >
                    {onRowSelect && (
                      <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label="Kaydı seç"
                          checked={presentSelected.has(row.id)}
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
            {((safePage - 1) * pageSize) + 1}–{Math.min(safePage * pageSize, effectiveTotal)} / {effectiveTotal} kayıt
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => changePage(safePage - 1)}
              disabled={safePage <= 1}
              aria-label="Önceki sayfa"
              className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-muted-foreground hover:text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(safePage - 3, totalPages - 6)) + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => changePage(pageNum)}
                  className={cn(
                    'w-9 h-9 rounded-lg text-sm font-medium transition-colors',
                    pageNum === safePage
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'border border-neutral-200 dark:border-neutral-700 text-muted-foreground hover:text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-900'
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => changePage(safePage + 1)}
              disabled={safePage >= totalPages}
              aria-label="Sonraki sayfa"
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
