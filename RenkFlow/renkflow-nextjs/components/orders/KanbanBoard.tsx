'use client';

import { useState, useMemo, useCallback, memo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  pointerWithin,
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
import { useAuth } from '@/lib/context/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { realtime } from '@/lib/realtime/client';
import { PresenceUser } from '@/lib/realtime/types';
import { Clock, Settings2, CheckCircle, Search, ArrowUp, ArrowDown, ChevronsUpDown, Inbox } from 'lucide-react';

interface KanbanBoardProps {
  orders: Order[];
  onOrderStatusChange: (orderId: string, newStatus: OrderStatus) => void;
  onOrderDelete?: (orderId: string) => void;
}

interface ColumnData {
  status: OrderStatus;
  title: string;
  color: string;
  wipLimit: number;
}

const columns: ColumnData[] = [
  { status: 'pending', title: 'Beklemede', color: 'yellow', wipLimit: 12 },
  { status: 'in_production', title: 'Üretimde', color: 'blue', wipLimit: 8 },
  { status: 'delivered', title: 'Teslim Edildi', color: 'green', wipLimit: 999 },
];

// Column color configurations
const columnColors = {
  pending: {
    bg: 'bg-amber-50/50 dark:bg-amber-950/20',
    border: 'border-amber-200/50 dark:border-amber-800/30',
    hoverBorder: 'border-amber-400 dark:border-amber-500',
    badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
    icon: Clock,
    gradient: 'from-amber-500/10 to-transparent',
  },
  in_production: {
    bg: 'bg-blue-50/50 dark:bg-blue-950/20',
    border: 'border-blue-200/50 dark:border-blue-800/30',
    hoverBorder: 'border-blue-400 dark:border-blue-500',
    badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
    icon: Settings2,
    gradient: 'from-blue-500/10 to-transparent',
  },
  delivered: {
    bg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
    border: 'border-emerald-200/50 dark:border-emerald-800/30',
    hoverBorder: 'border-emerald-400 dark:border-emerald-500',
    badge: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
    icon: CheckCircle,
    gradient: 'from-emerald-500/10 to-transparent',
  },
};

// Memoized Droppable Column Component
const DroppableColumn = memo(function DroppableColumn({ 
  column, 
  orders, 
  children,
  isDragging,
  isCollapsed,
  onToggleCollapse,
  totalAmount,
  currency,
  presenceUsers,
}: { 
  column: ColumnData; 
  orders: Order[]; 
  children: React.ReactNode;
  isDragging: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  totalAmount: number;
  currency: string;
  presenceUsers: PresenceUser[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.status,
  });

  const colors = columnColors[column.status];
  const showDropIndicator = isOver && isDragging && !isCollapsed;
  const wipExceeded = orders.length > column.wipLimit;
  const visiblePresence = presenceUsers.slice(0, 3);
  const extraPresence = presenceUsers.length - visiblePresence.length;

  return (
    <motion.div
      ref={setNodeRef}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`
        flex flex-col ${isCollapsed ? 'w-20' : 'w-80'} flex-shrink-0 rounded-2xl p-4 border-2
        transition-all duration-300 ease-out
        ${colors.bg}
        ${showDropIndicator 
          ? `${colors.hoverBorder} shadow-xl scale-[1.02] ring-4 ring-primary/20` 
          : `${colors.border} shadow-sm`
        }
      `}
    >
      {/* Column Header */}
      <div className={`flex items-center justify-between ${isCollapsed ? 'mb-2' : 'mb-4'}`}>
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded-md ${colors.badge}`}>
            <colors.icon size={18} />
          </div>
          {!isCollapsed && (
            <h3 className="text-sm font-semibold text-text-light dark:text-text-dark uppercase tracking-wide">
              {column.title}
            </h3>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isCollapsed && wipExceeded && (
            <span className="text-[10px] font-semibold text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
              WIP {orders.length}/{column.wipLimit}
            </span>
          )}
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
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-lg hover:bg-white/70 dark:hover:bg-black/20 transition-colors"
            title={isCollapsed ? 'Kolonu genişlet' : 'Kolonu daralt'}
          >
            <ChevronsUpDown size={16} className="text-subtle-light dark:text-subtle-dark" />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] text-subtle-light dark:text-subtle-dark">
            Toplam: <span className="font-semibold text-text-light dark:text-text-dark">{formatCurrency(totalAmount, currency)}</span>
          </div>
          {presenceUsers.length > 0 && (
            <div className="flex -space-x-2">
              {visiblePresence.map((user) => (
                <div
                  key={user.id}
                  className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 bg-white flex items-center justify-center overflow-hidden text-[10px] font-semibold text-slate-600"
                  title={user.name}
                >
                  {user.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    user.name?.charAt(0) || '?'
                  )}
                </div>
              ))}
              {extraPresence > 0 && (
                <div className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 flex items-center justify-center">
                  +{extraPresence}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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

      {!isCollapsed ? (
        <div className="flex flex-col gap-3 min-h-[200px] transition-all duration-300">
          {children}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
          <span className="text-xl font-bold text-text-light dark:text-text-dark">{orders.length}</span>
          <span className="text-[10px] uppercase tracking-widest text-subtle-light dark:text-subtle-dark" style={{ writingMode: 'vertical-rl' }}>
            {column.title}
          </span>
        </div>
      )}

      {/* Empty State */}
      {orders.length === 0 && !showDropIndicator && !isCollapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-8 text-center"
        >
          <Inbox size={32} className="text-gray-300 dark:text-gray-600 mb-2" />
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

export function KanbanBoard({ orders, onOrderStatusChange, onOrderDelete }: KanbanBoardProps) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [draggedOrder, setDraggedOrder] = useState<Order | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<OrderStatus>>(new Set());
  const [localSearch, setLocalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [sortBy, setSortBy] = useState<'date' | 'totalAmount' | 'customerName' | 'deliveryDate'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);

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

  useEffect(() => {
    if (!user) return;
    const room = `tenant:${user.tenantId || 'default'}:orders`;
    realtime.connect(undefined, user.id, user.name || user.email || 'User');
    const unsubscribe = realtime.subscribe({
      room,
      onPresenceChange: (users) => setPresenceUsers(users),
    });
    realtime.join(room, { page: 'orders' });
    realtime.setPresence({
      name: user.name || user.email || 'User',
      email: user.email,
      avatar: user.avatar,
      currentPage: '/orders',
    });

    return () => {
      unsubscribe();
      realtime.leave(room);
    };
  }, [user]);

  const filteredOrders = useMemo(() => {
    let data = orders;
    const normalizedSearch = localSearch.trim().toLowerCase();
    if (normalizedSearch) {
      data = data.filter((order) =>
        [order.id, order.orderNumber, order.customerName, order.productName]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch))
      );
    }
    if (statusFilter !== 'all') {
      data = data.filter(order => order.status === statusFilter);
    }
    return data;
  }, [orders, localSearch, statusFilter]);

  const ordersByStatus = useMemo(() => {
    const grouped: Record<OrderStatus, Order[]> = {
      pending: [],
      in_production: [],
      delivered: [],
    };

    const getSortValue = (order: Order) => {
      switch (sortBy) {
        case 'totalAmount':
          return order.totalAmount || 0;
        case 'customerName':
          return order.customerName || '';
        case 'deliveryDate':
          return order.deliveryDate ? new Date(order.deliveryDate).getTime() : 0;
        case 'date':
        default:
          return order.date ? new Date(order.date).getTime() : 0;
      }
    };

    const compare = (a: Order, b: Order) => {
      const aValue = getSortValue(a);
      const bValue = getSortValue(b);

      if (typeof aValue === 'string' || typeof bValue === 'string') {
        const left = String(aValue);
        const right = String(bValue);
        return sortDirection === 'asc'
          ? left.localeCompare(right, 'tr')
          : right.localeCompare(left, 'tr');
      }

      return sortDirection === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    };

    filteredOrders.forEach(order => {
      grouped[order.status].push(order);
    });

    (Object.keys(grouped) as OrderStatus[]).forEach((status) => {
      grouped[status].sort(compare);
    });

    return grouped;
  }, [filteredOrders, sortBy, sortDirection]);

  const columnTotals = useMemo(() => {
    return (Object.keys(ordersByStatus) as OrderStatus[]).reduce((acc, status) => {
      acc[status] = ordersByStatus[status].reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      return acc;
    }, {} as Record<OrderStatus, number>);
  }, [ordersByStatus]);

  const presenceByStatus = useMemo(() => {
    const map: Record<OrderStatus, PresenceUser[]> = {
      pending: [],
      in_production: [],
      delivered: [],
    };
    presenceUsers.forEach((presence) => {
      if (!presence.viewingOrderId) return;
      const matchingOrder = orders.find(order => order.id === presence.viewingOrderId);
      if (matchingOrder) {
        map[matchingOrder.status].push(presence);
      }
    });
    return map;
  }, [presenceUsers, orders]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const order = orders.find((o) => o.id === event.active.id);
    if (order) {
      setDraggedOrder(order);
      setIsDragging(true);
      if (realtime.isConnected()) {
        realtime.setPresence({ viewingOrderId: order.id, currentPage: '/orders' });
      }
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
    if (realtime.isConnected()) {
      realtime.setPresence({ viewingOrderId: undefined });
    }
  }, [orders, onOrderStatusChange, showToast]);

  const handleDragCancel = useCallback(() => {
    setDraggedOrder(null);
    setIsDragging(false);
    if (realtime.isConnected()) {
      realtime.setPresence({ viewingOrderId: undefined });
    }
  }, []);

  const toggleColumnCollapse = useCallback((status: OrderStatus) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);

  const statusFilters: { value: 'all' | OrderStatus; label: string }[] = [
    { value: 'all', label: 'Tümü' },
    { value: 'pending', label: 'Beklemede' },
    { value: 'in_production', label: 'Üretimde' },
    { value: 'delivered', label: 'Teslim Edildi' },
  ];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      measuring={measuringConfig}
    >
      {/* Toolbar */}
      <div className="mb-4 rounded-2xl border border-border-light dark:border-border-dark bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
             <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Sipariş ara..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  statusFilter === filter.value
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:text-slate-700'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-600 dark:text-slate-200"
            >
              <option value="date">Tarih</option>
              <option value="deliveryDate">Teslimat</option>
              <option value="totalAmount">Tutar</option>
              <option value="customerName">Müşteri</option>
            </select>
            <button
              onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-700"
              title="Sıralama yönü"
            >
              {sortDirection === 'asc' ? <ArrowUp size={18} /> : <ArrowDown size={18} />}
            </button>
          </div>

          {(localSearch || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setLocalSearch('');
                setStatusFilter('all');
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              Filtreleri Temizle
            </button>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{filteredOrders.length} sipariş gösteriliyor</span>
          {presenceUsers.length > 0 && (
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {presenceUsers.length} aktif kullanıcı
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-5 overflow-x-auto pb-4 px-1 -mx-1 scroll-smooth snap-x snap-mandatory md:snap-none">
        {columns
          .filter((column) => statusFilter === 'all' || column.status === statusFilter)
          .map((column, index) => {
          const columnOrders = ordersByStatus[column.status];

          return (
            <motion.div
              key={column.status}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
              className="snap-center"
            >
              <DroppableColumn
                column={column}
                orders={columnOrders}
                isDragging={isDragging}
                isCollapsed={collapsedColumns.has(column.status)}
                onToggleCollapse={() => toggleColumnCollapse(column.status)}
                totalAmount={columnTotals[column.status]}
                currency={columnOrders[0]?.currency || '₺'}
                presenceUsers={presenceByStatus[column.status] || []}
              >
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
                        onMouseEnter={() => {
                          if (realtime.isConnected()) {
                            realtime.setPresence({ viewingOrderId: order.id, currentPage: '/orders' });
                          }
                        }}
                        onMouseLeave={() => {
                          if (realtime.isConnected()) {
                            realtime.setPresence({ viewingOrderId: undefined });
                          }
                        }}
                      >
                        <OrderCard order={order} onDelete={onOrderDelete} />
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
      {typeof document !== 'undefined' &&
        createPortal(
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
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
}
