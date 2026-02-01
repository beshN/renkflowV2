'use client';

/**
 * List View Component
 * TanStack Table implementation with sorting, filtering, and bulk actions
 */

import { useState, useMemo, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  RowSelectionState,
  VisibilityState,
} from '@tanstack/react-table';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useViewStore } from '@/lib/stores/view.store';
import type { Order, OrderStatus, Priority } from '@/lib/types';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  MoreHorizontal,
  Trash2,
  Edit,
  Eye,
  Copy,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Package,
  AlertCircle,
  Settings2,
  Download,
  Filter,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  GripVertical,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface ListViewProps {
  data: Order[];
  isLoading?: boolean;
  onRowClick?: (order: Order) => void;
  onEdit?: (order: Order) => void;
  onDelete?: (orderId: string) => void;
  onBulkDelete?: (orderIds: string[]) => void;
  onBulkStatusChange?: (orderIds: string[], status: OrderStatus) => void;
  onExport?: (format: 'csv' | 'excel') => void;
}

// ============================================
// Status & Priority Renderers
// ============================================

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Bekliyor',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    icon: <Clock size={14} />,
  },
  in_production: {
    label: 'Üretimde',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: <Package size={14} />,
  },
  delivered: {
    label: 'Teslim Edildi',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: <CheckCircle2 size={14} />,
  },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string }> = {
  low: { label: 'Düşük', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  medium: { label: 'Orta', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  high: { label: 'Yüksek', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
  urgent: { label: 'Acil', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', config.color)}>
      {config.icon}
      {config.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const config = PRIORITY_CONFIG[priority];
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', config.color)}>
      {config.label}
    </span>
  );
}

// ============================================
// Column Definitions
// ============================================

function createColumns(
  onEdit?: (order: Order) => void,
  onDelete?: (orderId: string) => void,
  onRowClick?: (order: Order) => void
): ColumnDef<Order>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
      ),
      size: 40,
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'orderNumber',
      header: ({ column }) => (
        <SortableHeader column={column} label="Sipariş No" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium text-blue-600 dark:text-blue-400">
          #{row.getValue('orderNumber')}
        </span>
      ),
      size: 120,
    },
    {
      accessorKey: 'customerName',
      header: ({ column }) => (
        <SortableHeader column={column} label="Müşteri" />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-900 dark:text-white">
            {row.getValue('customerName')}
          </span>
          {row.original.email && (
            <span className="text-xs text-slate-500">{row.original.email}</span>
          )}
        </div>
      ),
      size: 200,
    },
    {
      accessorKey: 'productName',
      header: ({ column }) => (
        <SortableHeader column={column} label="Ürün" />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-slate-900 dark:text-white">
            {row.getValue('productName') || '-'}
          </span>
          {row.original.quantity && (
            <span className="text-xs text-slate-500">
              Miktar: {row.original.quantity}
            </span>
          )}
        </div>
      ),
      size: 180,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <SortableHeader column={column} label="Durum" />
      ),
      cell: ({ row }) => <StatusBadge status={row.getValue('status')} />,
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
      size: 140,
    },
    {
      accessorKey: 'priority',
      header: ({ column }) => (
        <SortableHeader column={column} label="Öncelik" />
      ),
      cell: ({ row }) => {
        const priority = row.getValue('priority') as Priority | undefined;
        return priority ? <PriorityBadge priority={priority} /> : '-';
      },
      size: 100,
    },
    {
      accessorKey: 'totalAmount',
      header: ({ column }) => (
        <SortableHeader column={column} label="Tutar" className="justify-end" />
      ),
      cell: ({ row }) => {
        const amount = row.getValue('totalAmount') as number;
        const currency = row.original.currency || '₺';
        return (
          <span className="font-medium text-slate-900 dark:text-white">
            {currency}{amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </span>
        );
      },
      size: 120,
    },
    {
      accessorKey: 'date',
      header: ({ column }) => (
        <SortableHeader column={column} label="Tarih" />
      ),
      cell: ({ row }) => (
        <span className="text-slate-600 dark:text-slate-400">
          {new Date(row.getValue('date')).toLocaleDateString('tr-TR')}
        </span>
      ),
      size: 110,
    },
    {
      accessorKey: 'deliveryDate',
      header: ({ column }) => (
        <SortableHeader column={column} label="Teslim" />
      ),
      cell: ({ row }) => {
        const date = row.getValue('deliveryDate') as string | undefined;
        if (!date) return '-';
        
        const deliveryDate = new Date(date);
        const isOverdue = deliveryDate < new Date() && row.original.status !== 'delivered';
        
        return (
          <span className={cn(
            isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-slate-600 dark:text-slate-400'
          )}>
            {deliveryDate.toLocaleDateString('tr-TR')}
            {isOverdue && <AlertCircle size={12} className="inline ml-1" />}
          </span>
        );
      },
      size: 110,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <ActionMenu
          order={row.original}
          onView={() => onRowClick?.(row.original)}
          onEdit={() => onEdit?.(row.original)}
          onDelete={() => onDelete?.(row.original.id as string)}
        />
      ),
      size: 60,
      enableSorting: false,
      enableHiding: false,
    },
  ];
}

// ============================================
// Sortable Header
// ============================================

function SortableHeader({
  column,
  label,
  className,
}: {
  column: any;
  label: string;
  className?: string;
}) {
  const sorted = column.getIsSorted();

  return (
    <button
      onClick={() => column.toggleSorting(sorted === 'asc')}
      className={cn(
        'flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
        className
      )}
    >
      {label}
      {sorted === 'asc' ? (
        <ChevronUp size={14} />
      ) : sorted === 'desc' ? (
        <ChevronDown size={14} />
      ) : (
        <ChevronsUpDown size={14} className="text-slate-400" />
      )}
    </button>
  );
}

// ============================================
// Action Menu
// ============================================

function ActionMenu({
  order,
  onView,
  onEdit,
  onDelete,
}: {
  order: Order;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
      >
        <MoreHorizontal size={16} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg z-50"
            >
              <button
                onClick={() => { onView(); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Eye size={14} />
                Görüntüle
              </button>
              <button
                onClick={() => { onEdit(); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Edit size={14} />
                Düzenle
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(order.id as string); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Copy size={14} />
                ID Kopyala
              </button>
              <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
              <button
                onClick={() => { onDelete(); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 size={14} />
                Sil
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Main List View Component
// ============================================

export function ListView({
  data,
  isLoading = false,
  onRowClick,
  onEdit,
  onDelete,
  onBulkDelete,
  onBulkStatusChange,
  onExport,
}: ListViewProps) {
  const { listConfig } = useViewStore();

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState('');

  // Columns
  const columns = useMemo(
    () => createColumns(onEdit, onDelete, onRowClick),
    [onEdit, onDelete, onRowClick]
  );

  // Table instance
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      columnVisibility,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: true,
  });

  const selectedCount = Object.keys(rowSelection).length;
  const selectedIds = Object.keys(rowSelection);

  // Row height classes
  const rowHeightClass = {
    compact: 'h-10',
    normal: 'h-14',
    relaxed: 'h-16',
  }[listConfig.rowHeight];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Ara..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {globalFilter && (
            <button
              onClick={() => setGlobalFilter('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <div className="flex items-center gap-2 mr-4">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {selectedCount} seçili
              </span>
              <button
                onClick={() => onBulkDelete?.(selectedIds)}
                className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
              >
                <Trash2 size={14} className="inline mr-1" />
                Sil
              </button>
            </div>
          )}

          <button
            onClick={() => onExport?.('excel')}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <Download size={16} />
            Dışa Aktar
          </button>

          <button className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <Filter size={16} />
            Filtre
          </button>

          <button className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <Settings2 size={16} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      'px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider',
                      listConfig.showGridLines && 'border-r border-slate-200 dark:border-slate-700'
                    )}
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className={rowHeightClass}>
                  {columns.map((_, j) => (
                    <td key={j} className="px-4 py-2">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              // Empty state
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <Package size={48} className="text-slate-300" />
                    <p className="font-medium">Sipariş bulunamadı</p>
                    <p className="text-sm">Yeni bir sipariş ekleyerek başlayın</p>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, index) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => onRowClick?.(row.original)}
                  className={cn(
                    rowHeightClass,
                    'border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors',
                    row.getIsSelected() && 'bg-blue-50 dark:bg-blue-900/20',
                    listConfig.stripedRows && index % 2 === 1 && 'bg-slate-50/50 dark:bg-slate-800/25'
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        'px-4 py-2',
                        listConfig.showGridLines && 'border-r border-slate-100 dark:border-slate-800'
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          {table.getFilteredRowModel().rows.length} kayıttan{' '}
          {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} -{' '}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
            table.getFilteredRowModel().rows.length
          )}{' '}
          gösteriliyor
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronsLeft size={16} />
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
          </button>

          <span className="text-sm text-slate-600 dark:text-slate-400">
            Sayfa {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>

          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronsRight size={16} />
          </button>

          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="ml-4 px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / sayfa
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
