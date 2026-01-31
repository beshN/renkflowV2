'use client';

import { useState, useMemo, useCallback, memo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDroppable,
  DragOverlay,
  MeasuringStrategy,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { OrderCard } from './OrderCard';
import { Order, OrderStatus } from '@/lib/types';
import { useToast } from '@/lib/context/ToastContext';

interface KanbanBoardProps {
  orders: Order[];
  onOrderStatusChange: (orderId: string, newStatus: OrderStatus) => void;
}

interface ColumnData {
  status: OrderStatus;
  title: string;
  color: string;
}

const columns: ColumnData[] = [
  { status: 'pending', title: 'Beklemede', color: 'yellow' },
  { status: 'in_production', title: 'Üretimde', color: 'blue' },
  { status: 'delivered', title: 'Teslim Edildi', color: 'green' },
];

// Column color configurations
const columnColors = {
  pending: {
    bg: 'bg-amber-50/50 dark:bg-amber-950/20',
    border: 'border-amber-200/50 dark:border-amber-800/30',
    hoverBorder: 'border-amber-400 dark:border-amber-500',
    badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
    icon: 'schedule',
    gradient: 'from-amber-500/10 to-transparent',
  },
  in_production: {
    bg: 'bg-blue-50/50 dark:bg-blue-950/20',
    border: 'border-blue-200/50 dark:border-blue-800/30',
    hoverBorder: 'border-blue-400 dark:border-blue-500',
    badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
    icon: 'precision_manufacturing',
    gradient: 'from-blue-500/10 to-transparent',
  },
  delivered: {
    bg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
    border: 'border-emerald-200/50 dark:border-emerald-800/30',
    hoverBorder: 'border-emerald-400 dark:border-emerald-500',
    badge: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
    icon: 'check_circle',
    gradient: 'from-emerald-500/10 to-transparent',
  },
};

// Memoized Droppable Column Component
const DroppableColumn = memo(function DroppableColumn({ 
  column, 
  orders, 
  children,
  isDragging 
}: { 
  column: ColumnData; 
  orders: Order[]; 
  children: React.ReactNode;
  isDragging: boolean;
}) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: column.status,
  });

  const colors = columnColors[column.status];
  const showDropIndicator = isOver && isDragging;

  return (
    <motion.div
      ref={setNodeRef}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`
        flex flex-col w-80 flex-shrink-0 rounded-2xl p-4 border-2
        transition-all duration-300 ease-out
        ${colors.bg}
        ${showDropIndicator 
          ? `${colors.hoverBorder} shadow-xl scale-[1.02] ring-4 ring-primary/20` 
          : `${colors.border} shadow-sm`
        }
      `}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined text-lg ${colors.badge.split(' ').slice(2).join(' ')}`}>
            {colors.icon}
          </span>
          <h3 className="text-sm font-semibold text-text-light dark:text-text-dark uppercase tracking-wide">
            {column.title}
          </h3>
        </div>
        <motion.span 
          key={orders.length}
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className={`
            text-xs font-bold rounded-full px-2.5 py-1 transition-all duration-300
            ${showDropIndicator 
              ? 'bg-primary text-white shadow-lg' 
              : colors.badge
            }
          `}
        >
          {orders.length}
        </motion.span>
      </div>

      {/* Drop Indicator */}
      <AnimatePresence>
        {showDropIndicator && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 60 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className={`
              mb-3 rounded-xl border-2 border-dashed border-primary/50
              bg-gradient-to-b ${colors.gradient}
              flex items-center justify-center
            `}
          >
            <span className="text-xs text-primary font-medium">Buraya bırak</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cards Container */}
      <div className="flex flex-col gap-3 min-h-[200px] transition-all duration-300">
        {children}
      </div>

      {/* Empty State */}
      {orders.length === 0 && !showDropIndicator && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-8 text-center"
        >
          <span className="material-symbols-outlined text-3xl text-gray-300 dark:text-gray-600 mb-2">
            inbox
          </span>
          <p className="text-xs text-gray-400 dark:text-gray-500">Sipariş yok</p>
        </motion.div>
      )}
    </motion.div>
  );
});

// Measuring configuration for smoother animations
const measuringConfig = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
};

export function KanbanBoard({ orders, onOrderStatusChange }: KanbanBoardProps) {
  const { showToast } = useToast();
  const [draggedOrder, setDraggedOrder] = useState<Order | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Optimized sensors for ultra-smooth drag experience
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Memoized order grouping
  const ordersByStatus = useMemo(() => {
    const grouped: Record<OrderStatus, Order[]> = {
      pending: [],
      in_production: [],
      delivered: [],
    };
    orders.forEach(order => {
      grouped[order.status].push(order);
    });
    return grouped;
  }, [orders]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const order = orders.find((o) => o.id === event.active.id);
    if (order) {
      setDraggedOrder(order);
      setIsDragging(true);
      // Add haptic feedback on mobile
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }
  }, [orders]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    setIsDragging(false);
    
    if (!over) {
      setDraggedOrder(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) {
      setDraggedOrder(null);
      return;
    }

    const activeOrder = orders.find(o => o.id === activeId);
    if (!activeOrder) {
      setDraggedOrder(null);
      return;
    }

    let newStatus: OrderStatus | undefined;
    const validStatuses: OrderStatus[] = ['pending', 'in_production', 'delivered'];
    
    if (validStatuses.includes(overId as OrderStatus)) {
      newStatus = overId as OrderStatus;
    } else {
      const overOrder = orders.find(o => o.id === overId);
      if (overOrder) {
        newStatus = overOrder.status;
      }
    }

    if (newStatus && activeOrder.status !== newStatus) {
      onOrderStatusChange(activeId, newStatus);
      showToast(`Sipariş durumu güncellendi!`, 'success');
      // Success haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([50, 30, 50]);
      }
    }
    
    setDraggedOrder(null);
  }, [orders, onOrderStatusChange, showToast]);

  const handleDragCancel = useCallback(() => {
    setDraggedOrder(null);
    setIsDragging(false);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      measuring={measuringConfig}
    >
      <div className="flex gap-5 overflow-x-auto pb-4 px-1 -mx-1 scroll-smooth snap-x snap-mandatory md:snap-none">
        {columns.map((column, index) => {
          const columnOrders = ordersByStatus[column.status];

          return (
            <motion.div
              key={column.status}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
              className="snap-center"
            >
              <DroppableColumn column={column} orders={columnOrders} isDragging={isDragging}>
                <SortableContext
                  items={columnOrders.map((o) => o.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <AnimatePresence mode="popLayout">
                    {columnOrders.map((order, orderIndex) => (
                      <motion.div
                        key={order.id}
                        layout
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: -20 }}
                        transition={{
                          type: 'spring',
                          stiffness: 500,
                          damping: 30,
                          mass: 0.8,
                          delay: orderIndex * 0.02,
                        }}
                      >
                        <OrderCard order={order} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </SortableContext>
              </DroppableColumn>
            </motion.div>
          );
        })}
      </div>

      {/* Enhanced Drag Overlay */}
      <DragOverlay
        dropAnimation={{
          duration: 300,
          easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
        }}
      >
        {draggedOrder ? (
          <motion.div
            initial={{ scale: 1, rotate: 0 }}
            animate={{ scale: 1.05, rotate: 3 }}
            className="cursor-grabbing"
          >
            <div className="shadow-2xl rounded-xl ring-2 ring-primary/30">
              <OrderCard order={draggedOrder} isDragOverlay />
            </div>
          </motion.div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
