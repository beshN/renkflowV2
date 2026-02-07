'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/client';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  showSummary?: boolean;
  showLimitSelector?: boolean;
  limitOptions?: number[];
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  showSummary = true,
  showLimitSelector = true,
  limitOptions = [10, 20, 50, 100],
  className = '',
}: PaginationProps) {
  const { t } = useTranslation();

  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  const getVisiblePages = (): (number | 'ellipsis')[] => {
    const delta = 2;
    const range: (number | 'ellipsis')[] = [];
    
    for (
      let i = Math.max(2, page - delta);
      i <= Math.min(totalPages - 1, page + delta);
      i++
    ) {
      range.push(i);
    }

    if (page - delta > 2) {
      range.unshift('ellipsis');
    }
    if (page + delta < totalPages - 1) {
      range.push('ellipsis');
    }

    range.unshift(1);
    if (totalPages > 1) {
      range.push(totalPages);
    }

    return range;
  };

  const visiblePages = getVisiblePages();

  if (totalPages <= 1 && !showSummary) {
    return null;
  }

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
      {/* Summary */}
      {showSummary && (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {total > 0 ? (
            <>
              <span className="font-medium text-slate-900 dark:text-white">{startItem}</span>
              {' - '}
              <span className="font-medium text-slate-900 dark:text-white">{endItem}</span>
              {' / '}
              <span className="font-medium text-slate-900 dark:text-white">{total}</span>
              {' '}{t('common.total')}
            </>
          ) : (
            t('orders.noOrdersFound')
          )}
        </div>
      )}

      <div className="flex items-center gap-4">
        {/* Limit Selector */}
        {showLimitSelector && onLimitChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Sayfa başına:
            </span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="
                px-2 py-1 text-sm rounded-lg
                bg-white dark:bg-slate-800
                border border-slate-200 dark:border-slate-700
                text-slate-900 dark:text-white
                focus:ring-2 focus:ring-primary/20 focus:border-primary
                outline-none
              "
            >
              {limitOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Page Controls */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            {/* First Page */}
            <button
              onClick={() => onPageChange(1)}
              disabled={page === 1}
              className="
                p-1.5 rounded-lg
                text-slate-500 dark:text-slate-400
                hover:bg-slate-100 dark:hover:bg-slate-800
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              "
              aria-label="First page"
            >
              <ChevronsLeft size={18} />
            </button>

            {/* Previous Page */}
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="
                p-1.5 rounded-lg
                text-slate-500 dark:text-slate-400
                hover:bg-slate-100 dark:hover:bg-slate-800
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              "
              aria-label="Previous page"
            >
              <ChevronLeft size={18} />
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1 mx-1">
              {visiblePages.map((p, idx) =>
                p === 'ellipsis' ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 text-slate-400 dark:text-slate-500"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => onPageChange(p)}
                    className={`
                      min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium
                      transition-all duration-200
                      ${page === p
                        ? 'bg-primary text-white shadow-md shadow-primary/20'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }
                    `}
                  >
                    {p}
                  </button>
                )
              )}
            </div>

            {/* Next Page */}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              className="
                p-1.5 rounded-lg
                text-slate-500 dark:text-slate-400
                hover:bg-slate-100 dark:hover:bg-slate-800
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              "
              aria-label="Next page"
            >
              <ChevronRight size={18} />
            </button>

            {/* Last Page */}
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={page === totalPages}
              className="
                p-1.5 rounded-lg
                text-slate-500 dark:text-slate-400
                hover:bg-slate-100 dark:hover:bg-slate-800
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              "
              aria-label="Last page"
            >
              <ChevronsRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
