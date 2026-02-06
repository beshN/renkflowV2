'use client';

/**
 * Kanban Board V2
 * Enhanced with swimlanes, WIP limits, and quick edit
 */

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Order, OrderStatus } from '@/lib/types';
import { useOrdersStore } from '@/lib/stores/orders.store';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  Paperclip, 
  ListChecks, 
  Edit2, 
  Clock, 
  Factory, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Inbox 
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface KanbanBoardV2Props {
  orders: Order[];
  onOrderClick?: (order: Order) => void;
  onStatusChange?: (orderId: string, status: OrderStatus) => void;
}

interface ColumnConfig {
  status: OrderStatus;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
}

// ============================================
// Column Configuration
// ============================================

const columns: ColumnConfig[] = [
  {
    status: 'pending',
    title: 'Beklemede',
    icon: Clock,
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
  },
  {
    status: 'in_production',
    title: 'Üretimde',
    icon: Factory,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  {
    status: 'delivered',
    title: 'Teslim Edildi',
    icon: CheckCircle2,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
  },
];

const statusIndicatorMap: Record<OrderStatus, string> = {
  pending: 'bg-yellow-500',
  in_production: 'bg-blue-500',
  delivered: 'bg-green-500',
};

// ============================================
// Sortable Order Card
// ============================================

const SortableOrderCard: React.FC<{
  order: Order;
  onClick?: () => void;
}> = ({ order, onClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: order.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOverdue = order.deliveryDate && new Date(order.deliveryDate) < new Date() && order.status !== 'delivered';
  const priorityBadge = order.priority
    ? {
        label: order.priority.toUpperCase(),
        className:
          order.priority === 'urgent'
            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
            : order.priority === 'high'
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            : order.priority === 'medium'
            ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
      }
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'group relative bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700',
        'hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-blue-500'
      )}
    >
      {/* Status indicator */}
      <div className={cn(
        'absolute left-0 top-4 bottom-4 w-1 rounded-r-full',
        statusIndicatorMap[order.status] || 'bg-gray-300'
      )} />

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
            {String(order.orderNumber || order.id).toUpperCase()}
          </span>
          <h4 className="font-medium text-gray-900 dark:text-white mt-0.5 line-clamp-1">
            {order.customerName}
          </h4>
        </div>
        {isOverdue && (
          <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full">
            Gecikmiş
          </span>
        )}
      </div>

      {/* Product */}
      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1 mb-3">
        {order.productName}
      </p>

      {/* Footer */}
      <div className="flex flex-col gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {formatCurrency(order.totalAmount || 0, order.currency)}
          </span>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <CalendarIcon className="w-4 h-4" />
            {formatDate(order.deliveryDate)}
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-500">
          <div className="flex items-center gap-2 flex-wrap">
            {priorityBadge && (
              <span className={cn('px-2 py-0.5 rounded-full font-semibold', priorityBadge.className)}>
                {priorityBadge.label}
              </span>
            )}
            {order.documents?.length ? (
              <span className="flex items-center gap-1 text-gray-500">
                <Paperclip className="w-3.5 h-3.5" />
                {order.documents.length}
              </span>
            ) : null}
            {order.customFields && Object.keys(order.customFields).length > 0 && (
              <span className="flex items-center gap-1 text-gray-500">
                <ListChecks className="w-3.5 h-3.5" />
                {Object.keys(order.customFields).length}
              </span>
            )}
          </div>
          <span className="text-gray-400">#{String(order.id).slice(-4)}</span>
        </div>
        {order.customFields && Object.keys(order.customFields).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {Object.entries(order.customFields).slice(0, 2).map(([key, value]) => (
              <span
                key={key}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                title={`${key}: ${String(value ?? '')}`}
              >
                {key}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions (visible on hover) */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Quick edit
          }}
          className="p-1 bg-white dark:bg-gray-700 rounded shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ============================================
// Drag Overlay Card
// ============================================

const DragOverlayCard: React.FC<{ order: Order }> = ({ order }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-2xl border-2 border-blue-500 w-72 rotate-3">
      <div className={cn(
        'absolute left-0 top-4 bottom-4 w-1 rounded-r-full',
        statusIndicatorMap[order.status] || 'bg-gray-300'
      )} />
      <div className="mb-3">
        <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
          {String(order.orderNumber || order.id).toUpperCase()}
        </span>
        <h4 className="font-medium text-gray-900 dark:text-white mt-0.5">
          {order.customerName}
        </h4>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        {order.productName}
      </p>
      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {formatCurrency(order.totalAmount || 0, order.currency)}
        </span>
      </div>
    </div>
  );
};

// ============================================
// Kanban Column
// ============================================

const KanbanColumn: React.FC<{
  config: ColumnConfig;
  orders: Order[];
  wipLimit: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onOrderClick?: (order: Order) => void;
}> = ({ config, orders, wipLimit, collapsed = false, onToggleCollapse, onOrderClick }) => {
  const count = orders.length;
  const isOverWip = count > wipLimit;
  const totalAmount = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const currency = orders[0]?.currency || 'TRY';
  const overdueOrders = orders.filter(
    (o) => o.deliveryDate && new Date(o.deliveryDate) < new Date() && o.status !== 'delivered'
  );

  return (
    <div className={cn('flex flex-col shrink-0', collapsed ? 'w-20' : 'w-80 min-w-[320px]')}>
      {/* Column Header */}
      <div className={cn(
        'rounded-t-xl p-4 border-2 border-b-0',
        config.bgColor,
        config.borderColor
      )}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <config.icon className={cn('w-5 h-5', config.color)} />
            {!collapsed && <h3 className={cn('font-semibold', config.color)}>{config.title}</h3>}
          </div>
          <div className="flex items-center gap-2">
            {!collapsed && (
              <div className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                isOverWip
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              )}>
                <span>{count}</span>
                <span>/</span>
                <span>{wipLimit}</span>
              </div>
            )}
            <button
              onClick={onToggleCollapse}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title={collapsed ? 'Kolonu aç' : 'Kolonu daralt'}
            >
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {!collapsed && (
          <>
            {/* Progress Bar */}
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  isOverWip ? 'bg-red-500' : config.color.includes('yellow') ? 'bg-yellow-500' : config.color.includes('blue') ? 'bg-blue-500' : config.color.includes('green') ? 'bg-green-500' : 'bg-red-500'
                )}
                style={{ width: `${Math.min((count / wipLimit) * 100, 100)}%` }}
              />
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{count} sipariş</span>
              <span className="font-medium">{formatCurrency(totalAmount, currency)}</span>
            </div>
          </>
        )}
      </div>

      {/* Column Body */}
      <div className={cn(
        'flex-1 p-3 space-y-3 rounded-b-xl border-2 border-t-0 overflow-y-auto max-h-[calc(100vh-300px)]',
        'bg-gray-50 dark:bg-gray-900/50',
        config.borderColor
      )}>
        {collapsed ? (
          <div className="flex items-center justify-center h-full">
            <config.icon className={cn('w-6 h-6', config.color)} />
          </div>
        ) : (
        <SortableContext
          items={orders.map((o) => o.id)}
          strategy={verticalListSortingStrategy}
        >
          <AnimatePresence>
            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <Inbox className="w-8 h-8 mb-2" />
                <p className="text-sm">Sipariş yok</p>
              </div>
            ) : (
              <>
                {overdueOrders.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-xs text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-300">
                    {overdueOrders.length} geciken sipariş var
                  </div>
                )}
                {orders.map((order) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <SortableOrderCard
                      order={order}
                      onClick={() => onOrderClick?.(order)}
                    />
                  </motion.div>
                ))}
              </>
            )}
          </AnimatePresence>
        </SortableContext>
        )}
      </div>
    </div>
  );
};

// ============================================
// Main Kanban Board V2
// ============================================

export const KanbanBoardV2: React.FC<KanbanBoardV2Props> = ({
  orders,
  onOrderClick,
  onStatusChange,
}) => {
  const { kanbanWipLimits, kanbanGroupBy } = useOrdersStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<OrderStatus>>(new Set());
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'urgent' | 'high' | 'medium' | 'low'>('all');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filteredOrders = useMemo(() => {
    if (priorityFilter === 'all') return orders;
    return orders.filter((order) => order.priority === priorityFilter);
  }, [orders, priorityFilter]);

  // Group orders by status
  const ordersByStatus = useMemo(() => {
    const groups: Record<OrderStatus, Order[]> = {
      pending: [],
      in_production: [],
      delivered: [],
    };

    filteredOrders.forEach((order) => {
      if (groups[order.status]) {
        groups[order.status].push(order);
      }
    });

    return groups;
  }, [filteredOrders]);

  // Find active order for drag overlay
  const activeOrder = useMemo(() => {
    if (!activeId) return null;
    return orders.find((o) => o.id === activeId);
  }, [activeId, orders]);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag over (for real-time visual feedback)
  const handleDragOver = (event: DragOverEvent) => {
    // Could implement real-time column preview here
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeOrder = orders.find((o) => o.id === active.id);
    if (!activeOrder) return;

    // Check if dropped on a column or another card
    const overId = over.id as string;
    
    // Find target status
    let targetStatus: OrderStatus | null = null;

    // Check if over is a column status
    if (['pending', 'in_production', 'delivered'].includes(overId)) {
      targetStatus = overId as OrderStatus;
    } else {
      // Find which column the target card is in
      const targetOrder = orders.find((o) => o.id === overId);
      if (targetOrder) {
        targetStatus = targetOrder.status;
      }
    }

    if (targetStatus && targetStatus !== activeOrder.status) {
      onStatusChange?.(activeOrder.id, targetStatus);
    }
  };

  return (
    <div className="space-y-4">
      {/* Board Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
          <span className="font-semibold text-gray-900 dark:text-white">Kanban Board</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {filteredOrders.length} kart
          </span>
          {priorityFilter !== 'all' && (
            <button
              onClick={() => setPriorityFilter('all')}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              Filtreyi temizle
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'urgent', 'high', 'medium', 'low'] as const).map((priority) => (
            <button
              key={priority}
              onClick={() => setPriorityFilter(priority)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                priorityFilter === priority
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white/70 text-slate-600 border-slate-200 dark:bg-slate-900/60 dark:text-slate-200 dark:border-slate-700'
              )}
            >
              {priority === 'all' ? 'Tümü' : priority.toUpperCase()}
            </button>
          ))}
          <Link
            href="/new-order"
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700"
          >
            + Yeni kart
          </Link>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 p-4 overflow-x-auto min-h-[600px]">
          {columns.map((column) => (
            <KanbanColumn
              key={column.status}
              config={column}
              orders={ordersByStatus[column.status]}
              wipLimit={kanbanWipLimits[column.status] || 15}
              collapsed={collapsedColumns.has(column.status)}
              onToggleCollapse={() => {
                setCollapsedColumns((prev) => {
                  const next = new Set(prev);
                  if (next.has(column.status)) {
                    next.delete(column.status);
                  } else {
                    next.add(column.status);
                  }
                  return next;
                });
              }}
              onOrderClick={onOrderClick}
            />
          ))}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeOrder ? <DragOverlayCard order={activeOrder} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default KanbanBoardV2;
