'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
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

function DroppableColumn({ column, orders, children }: { column: ColumnData; orders: Order[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.status,
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col w-80 flex-shrink-0 rounded-xl p-4 border 
        transition-all duration-200 ease-in-out
        ${isOver 
          ? 'border-primary border-2 bg-primary/10 dark:bg-primary/5 shadow-lg scale-[1.02]' 
          : 'border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark shadow-sm'
        }
      `}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-text-light dark:text-text-dark">
          {column.title}
        </h3>
        <span className={`
          text-sm font-medium rounded-full px-2 py-0.5 transition-colors
          ${isOver 
            ? 'bg-primary text-white' 
            : 'text-subtle-light dark:text-subtle-dark bg-gray-200 dark:bg-gray-700'
          }
        `}>
          {orders.length}
        </span>
      </div>

      {/* Cards */}
      {children}
    </div>
  );
}

export function KanbanBoard({ orders, onOrderStatusChange }: KanbanBoardProps) {
  const { showToast } = useToast();
  const [draggedOrder, setDraggedOrder] = useState<Order | null>(null);

  // Optimize sensors for ultra-smooth drag experience
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Slight drag distance to differentiate from clicks
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragEndEvent) => {
    const order = orders.find((o) => o.id === event.active.id);
    if (order) {
      setDraggedOrder(order);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) {
      setDraggedOrder(null);
      return;
    }

    // Find the active order
    const activeOrder = orders.find(o => o.id === activeId);
    if (!activeOrder) {
      setDraggedOrder(null);
      return;
    }

    // Determine the new status
    let newStatus: OrderStatus | undefined;

    // Check if dropped on a column (status)
    const validStatuses: OrderStatus[] = ['pending', 'in_production', 'delivered'];
    if (validStatuses.includes(overId as OrderStatus)) {
      newStatus = overId as OrderStatus;
    } else {
      // Dropped on another card - find that card's status
      const overOrder = orders.find(o => o.id === overId);
      if (overOrder) {
        newStatus = overOrder.status;
      }
    }

    // Only update if status actually changed
    if (newStatus && activeOrder.status !== newStatus) {
      onOrderStatusChange(activeId, newStatus);
      showToast(`Sipariş durumu güncellendi!`, 'success');
    }
    
    setDraggedOrder(null);
  };

  const getOrdersByStatus = (status: OrderStatus) => {
    return orders.filter((order) => order.status === status);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6 overflow-x-auto pb-4">
        {columns.map((column) => {
          const columnOrders = getOrdersByStatus(column.status);

          return (
            <DroppableColumn key={column.status} column={column} orders={columnOrders}>
              <SortableContext
                items={columnOrders.map((o) => o.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-3 min-h-[200px]">
                  {columnOrders.map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </div>
              </SortableContext>
            </DroppableColumn>
          );
        })}
      </div>

      {/* Drag Overlay for better visual feedback */}
      <DragOverlay>
        {draggedOrder ? (
          <div className="rotate-6 opacity-80">
            <OrderCard order={draggedOrder} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
