'use client';

/**
 * Kanban Board V2
 * Enhanced with swimlanes, WIP limits, and quick edit
 */

import React, { useState, useMemo } from 'react';
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
  icon: string;
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
    icon: 'pending_actions',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
  },
  {
    status: 'in_production',
    title: 'Üretimde',
    icon: 'precision_manufacturing',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  {
    status: 'delivered',
    title: 'Teslim Edildi',
    icon: 'check_circle',
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
      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {formatCurrency(order.totalAmount || 0, order.currency)}
        </span>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span className="material-symbols-outlined text-sm">calendar_today</span>
          {formatDate(order.deliveryDate)}
        </div>
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
          <span className="material-symbols-outlined text-sm">edit</span>
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
  onOrderClick?: (order: Order) => void;
}> = ({ config, orders, wipLimit, onOrderClick }) => {
  const count = orders.length;
  const isOverWip = count > wipLimit;
  const totalAmount = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const currency = orders[0]?.currency || '₺';

  return (
    <div className="flex flex-col w-80 min-w-[320px] shrink-0">
      {/* Column Header */}
      <div className={cn(
        'rounded-t-xl p-4 border-2 border-b-0',
        config.bgColor,
        config.borderColor
      )}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={cn('material-symbols-outlined', config.color)}>
              {config.icon}
            </span>
            <h3 className={cn('font-semibold', config.color)}>{config.title}</h3>
          </div>
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
        </div>

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
      </div>

      {/* Column Body */}
      <div className={cn(
        'flex-1 p-3 space-y-3 rounded-b-xl border-2 border-t-0 overflow-y-auto max-h-[calc(100vh-300px)]',
        'bg-gray-50 dark:bg-gray-900/50',
        config.borderColor
      )}>
        <SortableContext
          items={orders.map((o) => o.id)}
          strategy={verticalListSortingStrategy}
        >
          <AnimatePresence>
            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <span className="material-symbols-outlined text-3xl mb-2">inbox</span>
                <p className="text-sm">Sipariş yok</p>
              </div>
            ) : (
              orders.map((order) => (
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
              ))
            )}
          </AnimatePresence>
        </SortableContext>
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

  // Group orders by status
  const ordersByStatus = useMemo(() => {
    const groups: Record<OrderStatus, Order[]> = {
      pending: [],
      in_production: [],
      delivered: [],
    };

    orders.forEach((order) => {
      if (groups[order.status]) {
        groups[order.status].push(order);
      }
    });

    return groups;
  }, [orders]);

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
            onOrderClick={onOrderClick}
          />
        ))}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeOrder ? <DragOverlayCard order={activeOrder} /> : null}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanBoardV2;
