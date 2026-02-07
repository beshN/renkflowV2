'use client';

/**
 * Enterprise DataGrid Component
 * Virtualized, sortable, resizable, with inline editing
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  RowSelectionState,
  ColumnResizeMode,
  Header,
  Row,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Order } from '@/lib/types';
import { useOrdersStore } from '@/lib/stores/orders.store';
import { formatCurrency, formatDate, getOrderStatusInfo } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { OrderHoverCard } from './OrderHoverCard';
import {
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Edit,
  Trash2
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface DataGridProps {
  data: Order[];
  isLoading?: boolean;
  onRowClick?: (order: Order) => void;
  onRowDoubleClick?: (order: Order) => void;
}

// ============================================
// Inline Edit Cell
// ============================================

const InlineEditCell: React.FC<{
  value: string | number;
  row: Row<Order>;
  columnId: string;
  type?: 'text' | 'number' | 'select';
  options?: { value: string; label: string }[];
}> = ({ value, row, columnId, type = 'text', options }) => {
  const { editingCell, startEditing, updateEditingValue, commitEdit, cancelEdit } = useOrdersStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditing = editingCell?.rowId === row.original.id && editingCell?.columnId === columnId;

  const handleDoubleClick = () => {
    startEditing(row.original.id, columnId, value);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      commitEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit();
      // Would navigate to next cell here
    }
  };

  if (isEditing) {
    if (type === 'select' && options) {
      return (
        <select
          ref={inputRef as any}
          value={editingCell.currentValue as string}
          onChange={(e) => updateEditingValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitEdit}
          className="w-full h-full px-2 py-1 border-2 border-primary-500 rounded focus:outline-none bg-white dark:bg-neutral-800"
          autoFocus
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        ref={inputRef}
        type={type}
        value={editingCell.currentValue as string}
        onChange={(e) => {
          if (type === 'number') {
            const next = parseFloat(e.target.value);
            updateEditingValue(Number.isNaN(next) ? 0 : next);
          } else {
            updateEditingValue(e.target.value);
          }
        }}
        onKeyDown={handleKeyDown}
        onBlur={commitEdit}
        className="w-full h-full px-2 py-1 border-2 border-primary-500 rounded focus:outline-none bg-white dark:bg-neutral-800"
        autoFocus
      />
    );
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className="cursor-text px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
    >
      {value}
    </div>
  );
};

// ============================================
// Status Badge
// ============================================

const StatusBadge: React.FC<{ status: Order['status'] }> = ({ status }) => {
  const info = getOrderStatusInfo(status);
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      info?.className || 'bg-neutral-100 text-neutral-800'
    )}>
      {info?.label || status}
    </span>
  );
};

// ============================================
// Expandable Row Content
// ============================================

const ExpandedRowContent: React.FC<{ order: Order }> = ({ order }) => {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="bg-neutral-50 dark:bg-neutral-800/50 px-6 py-4 border-t border-neutral-200 dark:border-neutral-700"
    >
      <div className="grid grid-cols-4 gap-6">
        <div>
          <h4 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Müşteri Bilgileri</h4>
          <p className="mt-1 text-sm text-neutral-900 dark:text-white">{order.customerName}</p>
          {order.email && <p className="text-sm text-neutral-500">{order.email}</p>}
          {order.phone && <p className="text-sm text-neutral-500">{order.phone}</p>}
        </div>
        <div>
          <h4 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Ürün Detayları</h4>
          <p className="mt-1 text-sm text-neutral-900 dark:text-white">{order.productName}</p>
          <p className="text-sm text-neutral-500">Miktar: {order.quantity}</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Notlar</h4>
          <p className="mt-1 text-sm text-neutral-900 dark:text-white">
            {order.notes || 'Not bulunmuyor'}
          </p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Sektör Alanları</h4>
          {order.customFields && Object.keys(order.customFields).length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {Object.entries(order.customFields).slice(0, 4).map(([key, value]) => (
                <span key={key} className="rounded-full bg-neutral-100 px-2 py-1 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                  {key}: {String(value ?? '')}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-neutral-500">Alan bulunmuyor</p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ============================================
// Column Resize Handle
// ============================================

const ColumnResizeHandle: React.FC<{ header: Header<Order, unknown> }> = ({ header }) => {
  return (
    <div
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      className={cn(
        'absolute right-0 top-0 h-full w-1 bg-blue-500 cursor-col-resize select-none touch-none opacity-0 hover:opacity-100',
        header.column.getIsResizing() && 'opacity-100 bg-primary-600'
      )}
    />
  );
};

// ============================================
// Loading Skeleton
// ============================================

const LoadingSkeleton: React.FC = () => {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="h-10 bg-neutral-200 dark:bg-neutral-700 rounded w-10" />
          <div className="h-10 bg-neutral-200 dark:bg-neutral-700 rounded w-24" />
          <div className="h-10 bg-neutral-200 dark:bg-neutral-700 rounded flex-1" />
          <div className="h-10 bg-neutral-200 dark:bg-neutral-700 rounded w-32" />
          <div className="h-10 bg-neutral-200 dark:bg-neutral-700 rounded w-24" />
          <div className="h-10 bg-neutral-200 dark:bg-neutral-700 rounded w-20" />
        </div>
      ))}
    </div>
  );
};

// ============================================
// Empty State
// ============================================

const EmptyState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-24 h-24 mb-6 text-neutral-300 dark:text-neutral-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">
        Sipariş Bulunamadı
      </h3>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center max-w-sm">
        Arama kriterlerinize uygun sipariş bulunamadı. Filtreleri değiştirmeyi veya yeni sipariş eklemeyi deneyin.
      </p>
      <button className="mt-6 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
        Yeni Sipariş Ekle
      </button>
    </div>
  );
};

// ============================================
// Main DataGrid Component
// ============================================

export const DataGrid: React.FC<DataGridProps> = ({
  data,
  isLoading = false,
  onRowClick,
  onRowDoubleClick,
}) => {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnResizeMode] = useState<ColumnResizeMode>('onChange');

  const {
    selectedIds,
    toggleRowSelection,
    selectAll,
    clearSelection,
    expandedRowIds,
    toggleRowExpanded,
    columns: columnConfig,
    dirtyRows,
  } = useOrdersStore();

  // Convert Set to object for react-table
  const rowSelection = useMemo(() => {
    const selection: RowSelectionState = {};
    selectedIds.forEach((id) => {
      selection[id] = true;
    });
    return selection;
  }, [selectedIds]);

  // Define columns
  const columns = useMemo<ColumnDef<Order>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          onChange={(e) => {
            if (e.target.checked) {
              selectAll('page', table.getRowModel().rows.map((row) => row.original.id));
            } else {
              clearSelection();
            }
          }}
          className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.original.id)}
          onChange={() => toggleRowSelection(row.original.id)}
          onClick={(e: React.MouseEvent<HTMLElement>) => e.stopPropagation()}
          className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
        />
      ),
      size: 40,
      enableResizing: false,
    },
    {
      id: 'expand',
      header: '',
      cell: ({ row }) => (
        <button
          onClick={(e: React.MouseEvent<HTMLElement>) => {
            e.stopPropagation();
            toggleRowExpanded(row.original.id);
          }}
          className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded"
        >
          <ChevronRight 
            size={20}
            className={cn(
              'text-neutral-500 transition-transform',
              expandedRowIds.has(row.original.id) && 'rotate-90'
            )}
          />
        </button>
      ),
      size: 40,
      enableResizing: false,
    },
    {
      accessorKey: 'orderNumber',
      header: 'Sipariş No',
      cell: ({ getValue, row }) => (
        <span className="font-mono text-sm text-primary-600 dark:text-blue-400">
          {String(getValue() || row.original.id).toUpperCase()}
        </span>
      ),
      size: 120,
    },
    {
      accessorKey: 'customerName',
      header: 'Müşteri',
      cell: ({ getValue, row }) => (
        <OrderHoverCard order={row.original} side="right" align="start">
          <InlineEditCell
            value={getValue() as string}
            row={row}
            columnId="customerName"
          />
        </OrderHoverCard>
      ),
      size: 180,
    },
    {
      accessorKey: 'productName',
      header: 'Ürün',
      cell: ({ getValue, row }) => (
        <InlineEditCell
          value={getValue() as string}
          row={row}
          columnId="productName"
        />
      ),
      size: 200,
    },
    {
      id: 'customFields',
      header: 'Sektör Alanları',
      cell: ({ row }) => {
        const fields = row.original.customFields || {};
        const entries = Object.entries(fields);
        if (entries.length === 0) {
          return <span className="text-sm text-neutral-400">-</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {entries.slice(0, 2).map(([key, value]) => (
              <span
                key={key}
                className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                title={`${key}: ${String(value ?? '')}`}
              >
                {key}
              </span>
            ))}
          </div>
        );
      },
      size: 160,
    },
    {
      accessorKey: 'quantity',
      header: 'Miktar',
      cell: ({ getValue, row }) => (
        <InlineEditCell
          value={getValue() as number}
          row={row}
          columnId="quantity"
          type="number"
        />
      ),
      size: 80,
    },
    {
      accessorKey: 'totalAmount',
      header: 'Tutar',
      cell: ({ getValue, row }) => (
        <span className="font-medium">
          {formatCurrency(getValue() as number, row.original.currency)}
        </span>
      ),
      size: 120,
    },
    {
      accessorKey: 'status',
      header: 'Durum',
      cell: ({ getValue, row }) => {
        const status = getValue() as Order['status'];
        return (
          <InlineEditCell
            value={status}
            row={row}
            columnId="status"
            type="select"
            options={[
              { value: 'pending', label: 'Beklemede' },
              { value: 'in_production', label: 'Üretimde' },
              { value: 'delivered', label: 'Teslim Edildi' },
            ]}
          />
        );
      },
      size: 130,
    },
    {
      accessorKey: 'deliveryDate',
      header: 'Teslim Tarihi',
      cell: ({ getValue, row }) => {
        const date = getValue() as string;
        if (!date) {
          return <span className="text-sm text-neutral-400">-</span>;
        }
        const isOverdue = new Date(date) < new Date() && row.original.status !== 'delivered';
        return (
          <span className={cn(
            'text-sm',
            isOverdue && 'text-red-600 dark:text-red-400 font-medium'
          )}>
            {formatDate(date)}
          </span>
        );
      },
      size: 130,
    },
    {
      accessorKey: 'createdAt',
      header: 'Oluşturulma',
      cell: ({ getValue }) => (
        <span className="text-sm text-neutral-500">
          {formatDate(getValue() as string)}
        </span>
      ),
      size: 130,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e: React.MouseEvent<HTMLElement>) => {
              e.stopPropagation();
              // Edit action
            }}
            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded"
            title="Düzenle"
          >
            <Edit size={16} className="text-neutral-500" />
          </button>
          <button
            onClick={(e: React.MouseEvent<HTMLElement>) => {
              e.stopPropagation();
              // Delete action
            }}
            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600"
            title="Sil"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
      size: 80,
      enableResizing: false,
    },
  ], [selectedIds, expandedRowIds, toggleRowSelection, selectAll, clearSelection, toggleRowExpanded]);

  // Create table instance
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      rowSelection,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode,
    enableRowSelection: true,
    getRowId: (row) => row.id,
  });

  const { rows } = table.getRowModel();

  // Virtual row rendering for performance
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 52,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom = virtualRows.length > 0
    ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0)
    : 0;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (data.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-sm overflow-hidden">
      {/* Table Container */}
      <div
        ref={tableContainerRef}
        className="flex-1 overflow-auto bg-white dark:bg-neutral-900"
      >
        <table
          className="w-full border-collapse"
          style={{ width: table.getCenterTotalSize() }}
        >
          {/* Header */}
          <thead className="sticky top-0 z-10 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isFrozen = columnConfig.find(c => c.id === header.id)?.frozen;
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        'relative px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-800',
                        isFrozen && 'sticky left-0 bg-neutral-50 dark:bg-neutral-900 z-20 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)]',
                        header.column.getCanSort() && 'cursor-pointer select-none hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      )}
                      style={{ width: header.getSize() }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-2">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() && (
                          <span className="text-primary-600 dark:text-primary-400">
                            {header.column.getIsSorted() === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                          </span>
                        )}
                      </div>
                      {header.column.getCanResize() && (
                        <ColumnResizeHandle header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {/* Body */}
          <tbody className="bg-white dark:bg-neutral-900">
            {paddingTop > 0 && (
              <tr>
                <td style={{ height: `${paddingTop}px` }} />
              </tr>
            )}
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              const isExpanded = expandedRowIds.has(row.original.id);
              const isDirty = dirtyRows.has(row.original.id);
              const isSelected = selectedIds.has(row.original.id);

              return (
                <React.Fragment key={row.id}>
                  <tr
                    onClick={() => onRowClick?.(row.original)}
                    onDoubleClick={() => onRowDoubleClick?.(row.original)}
                    className={cn(
                      'group border-b border-neutral-100 dark:border-neutral-800 transition-colors',
                      isSelected
                        ? 'bg-primary-50/60 dark:bg-primary-900/10'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
                      isDirty && 'bg-amber-50/50 dark:bg-amber-900/10'
                    )}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isFrozen = columnConfig.find(c => c.id === cell.column.id)?.frozen;
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            'px-4 py-3 text-sm text-neutral-900 dark:text-neutral-200',
                            isFrozen && 'sticky left-0 z-10 bg-white dark:bg-neutral-900 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)]',
                            isFrozen && isSelected && 'bg-primary-50/60 dark:bg-primary-900/10',
                            isFrozen && !isSelected && 'group-hover:bg-neutral-50 dark:group-hover:bg-neutral-800/50'
                          )}
                          style={{ width: cell.column.getSize() }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                  {/* Expanded Row */}
                  <AnimatePresence>
                    {isExpanded && (
                      <tr>
                        <td colSpan={columns.length}>
                          <ExpandedRowContent order={row.original} />
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              );
            })}
            {paddingBottom > 0 && (
              <tr>
                <td style={{ height: `${paddingBottom}px` }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer with pagination info */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
        <div className="text-sm text-neutral-500 dark:text-neutral-400">
          {selectedIds.size > 0 ? (
            <span className="font-medium text-primary-600 dark:text-primary-400">
              {selectedIds.size} satır seçildi
            </span>
          ) : (
            <span>Toplam {data.length} sipariş</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {dirtyRows.size > 0 && (
            <span className="text-sm text-amber-600 dark:text-amber-400">
              {dirtyRows.size} değişiklik kaydedilmedi
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataGrid;
