// ============================================
// 6. PERFORMANCE OPTIMIZATION
// Large List Virtualization with @tanstack/react-virtual
// ============================================

'use client';

import { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';

// ============================================
// TYPES
// ============================================

interface VirtualListProps<T> {
  items: T[];
  height: number;
  itemHeight: number | ((index: number) => number);
  renderItem: (item: T, index: number, virtualItem: VirtualItem) => React.ReactNode;
  overscan?: number;
  className?: string;
  onEndReached?: () => void;
  endReachedThreshold?: number;
  isLoading?: boolean;
  loadingComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  headerComponent?: React.ReactNode;
  footerComponent?: React.ReactNode;
}

interface VirtualGridProps<T> {
  items: T[];
  height: number;
  columnCount: number;
  rowHeight: number;
  gap?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
}

// ============================================
// VIRTUAL LIST COMPONENT
// ============================================

export function VirtualList<T>({
  items,
  height,
  itemHeight,
  renderItem,
  overscan = 5,
  className = '',
  onEndReached,
  endReachedThreshold = 0.8,
  isLoading = false,
  loadingComponent,
  emptyComponent,
  headerComponent,
  footerComponent,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: typeof itemHeight === 'function' 
      ? itemHeight 
      : () => itemHeight,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Handle infinite scroll
  useEffect(() => {
    if (!onEndReached || hasReachedEnd || isLoading) return;

    const scrollElement = parentRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

      if (scrollPercentage >= endReachedThreshold) {
        setHasReachedEnd(true);
        onEndReached();
      }
    };

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, [onEndReached, endReachedThreshold, hasReachedEnd, isLoading]);

  // Reset end reached state when items change
  useEffect(() => {
    setHasReachedEnd(false);
  }, [items.length]);

  if (items.length === 0 && !isLoading) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        {emptyComponent ?? (
          <p className="text-gray-500">Gösterilecek öğe yok</p>
        )}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ height }}
    >
      {headerComponent}
      
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderItem(item, virtualItem.index, virtualItem)}
            </div>
          );
        })}
      </div>

      {isLoading && (
        loadingComponent ?? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )
      )}

      {footerComponent}
    </div>
  );
}

// ============================================
// VIRTUAL GRID COMPONENT
// ============================================

export function VirtualGrid<T>({
  items,
  height,
  columnCount,
  rowHeight,
  gap = 16,
  renderItem,
  overscan = 3,
  className = '',
}: VirtualGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const rowCount = Math.ceil(items.length / columnCount);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight + gap,
    overscan,
  });

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ height }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualRows.map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount;
          const rowItems = items.slice(startIndex, startIndex + columnCount);

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: rowHeight,
                transform: `translateY(${virtualRow.start}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                gap,
              }}
            >
              {rowItems.map((item, colIndex) => (
                <div key={startIndex + colIndex}>
                  {renderItem(item, startIndex + colIndex)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// VIRTUAL TABLE COMPONENT
// ============================================

interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: number | string;
  render?: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
}

interface VirtualTableProps<T> {
  data: T[];
  columns: Column<T>[];
  height: number;
  rowHeight?: number;
  headerHeight?: number;
  className?: string;
  onRowClick?: (item: T, index: number) => void;
  selectedIndex?: number;
}

export function VirtualTable<T extends Record<string, unknown>>({
  data,
  columns,
  height,
  rowHeight = 48,
  headerHeight = 48,
  className = '',
  onRowClick,
  selectedIndex,
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  const sortedData = useMemo(() => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === bValue) return 0;
      
      const comparison = aValue < bValue ? -1 : 1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [data, sortConfig]);

  const virtualizer = useVirtualizer({
    count: sortedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  const handleSort = useCallback((key: string) => {
    setSortConfig(current => {
      if (current?.key !== key) {
        return { key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  }, []);

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div className={`border rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div
        className="flex bg-gray-50 border-b font-medium text-sm text-gray-700"
        style={{ height: headerHeight }}
      >
        {columns.map((column) => (
          <div
            key={String(column.key)}
            className={`
              flex items-center px-4
              ${column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''}
            `}
            style={{ width: column.width ?? `${100 / columns.length}%` }}
            onClick={() => column.sortable && handleSort(String(column.key))}
          >
            {column.header}
            {column.sortable && sortConfig?.key === column.key && (
              <span className="ml-1">
                {sortConfig.direction === 'asc' ? '↑' : '↓'}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Body */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: height - headerHeight }}
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualRows.map((virtualRow) => {
            const item = sortedData[virtualRow.index];
            const isSelected = selectedIndex === virtualRow.index;

            return (
              <div
                key={virtualRow.key}
                className={`
                  flex items-center border-b text-sm
                  ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
                  ${onRowClick ? 'cursor-pointer' : ''}
                `}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: rowHeight,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => onRowClick?.(item, virtualRow.index)}
              >
                {columns.map((column) => (
                  <div
                    key={String(column.key)}
                    className="px-4 truncate"
                    style={{ width: column.width ?? `${100 / columns.length}%` }}
                  >
                    {column.render 
                      ? column.render(item, virtualRow.index)
                      : String(item[column.key as keyof T] ?? '')
                    }
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================
// INFINITE SCROLL HOOK
// ============================================

interface UseInfiniteScrollOptions {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  threshold?: number;
}

export function useInfiniteScroll({
  hasMore,
  isLoading,
  onLoadMore,
  threshold = 0.8,
}: UseInfiniteScrollOptions) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoading || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    observerRef.current = observer;

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, onLoadMore, threshold]);

  return loadMoreRef;
}

// ============================================
// WINDOWED SELECTION HOOK
// ============================================

export function useVirtualSelection<T>(
  items: T[],
  getItemId: (item: T) => string
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const toggleSelection = useCallback((index: number, shiftKey = false) => {
    const itemId = getItemId(items[index]);

    setSelectedIds(prev => {
      const newSet = new Set(prev);

      if (shiftKey && lastSelectedIndex !== null) {
        // Range selection
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        
        for (let i = start; i <= end; i++) {
          newSet.add(getItemId(items[i]));
        }
      } else {
        // Toggle single selection
        if (newSet.has(itemId)) {
          newSet.delete(itemId);
        } else {
          newSet.add(itemId);
        }
      }

      return newSet;
    });

    setLastSelectedIndex(index);
  }, [items, getItemId, lastSelectedIndex]);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map(getItemId)));
  }, [items, getItemId]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedIndex(null);
  }, []);

  const isSelected = useCallback((item: T) => {
    return selectedIds.has(getItemId(item));
  }, [selectedIds, getItemId]);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
  };
}
