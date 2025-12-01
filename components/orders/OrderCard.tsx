import Link from 'next/link';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Order } from '@/lib/types';
import { formatCurrency, formatDate, getOrderStatusInfo } from '@/lib/utils';
import { useAuth } from '@/lib/context/AuthContext';

interface OrderCardProps {
  order: Order;
  onStatusChange?: (id: string, newStatus: string) => void;
}

export function OrderCard({ order, onStatusChange }: OrderCardProps) {
  const { user } = useAuth();
  const statusInfo = getOrderStatusInfo(order.status);
  
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
    transition: isDragging 
      ? 'none' 
      : transition || 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        bg-white dark:bg-gray-900 rounded-lg p-4 border border-border-light dark:border-border-dark 
        cursor-grab active:cursor-grabbing
        transition-all duration-200 hover-lift animate-in-fade
        ${isDragging 
          ? 'shadow-2xl scale-105 rotate-3 z-50 opacity-90 ring-2 ring-primary/30' 
          : 'shadow-sm'
        }
      `}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-semibold text-text-light dark:text-text-dark">
          #{order.id}
        </h4>
        <Link
          href={`/orders/${order.id}`}
          className="text-primary hover:text-primary/80"
          onClick={(e) => {
            e.stopPropagation();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="material-symbols-outlined text-base">open_in_new</span>
        </Link>
      </div>

      {/* Customer */}
      <p className="text-sm text-subtle-light dark:text-subtle-dark mb-2">
        {order.customer}
      </p>

      {/* Amount */}
      <p className="text-sm font-medium text-text-light dark:text-text-dark mb-2">
        {formatCurrency(order.amount, order.currency)}
      </p>

      {/* Date */}
      <div className="flex items-center gap-2 text-xs text-subtle-light dark:text-subtle-dark mb-3">
        <span className="material-symbols-outlined text-sm">calendar_today</span>
        <span>{formatDate(order.date)}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-border-light dark:border-border-dark">
        {user?.role === 'admin' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              alert('Belge ekleme açılacak');
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">attach_file</span>
            Belge Ekle
          </button>
        )}

        {/* Progress indicator */}
        <div className="w-20 h-1 rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-1 rounded-full transition-all ${
              order.status === 'pending'
                ? 'w-1/4 bg-yellow-500'
                : order.status === 'in_production'
                ? 'w-2/3 bg-blue-500'
                : 'w-full bg-green-500'
            }`}
          ></div>
        </div>
      </div>
    </div>
  );
}
