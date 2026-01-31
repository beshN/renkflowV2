import { memo } from 'react';
import Link from 'next/link';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Order } from '@/lib/types';
import { formatCurrency, formatDate, getOrderStatusInfo } from '@/lib/utils';
import { useAuth } from '@/lib/context/AuthContext';
import { memo } from 'react';

interface OrderCardProps {
  order: Order;
  onStatusChange?: (id: string, newStatus: string) => void;
  isDragOverlay?: boolean;
}

<<<<<<< /Users/beshnovski/RenkFlow V2/RenkFlow/renkflow-nextjs/components/orders/OrderCard.tsx
function OrderCardComponent({ order, onStatusChange }: OrderCardProps) {
=======
const statusColors = {
  pending: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800/50',
    progress: 'bg-amber-500',
    progressBg: 'bg-amber-100 dark:bg-amber-900/30',
  },
  in_production: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800/50',
    progress: 'bg-blue-500',
    progressBg: 'bg-blue-100 dark:bg-blue-900/30',
  },
  delivered: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800/50',
    progress: 'bg-emerald-500',
    progressBg: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
};

export const OrderCard = memo(function OrderCard({ order, onStatusChange, isDragOverlay = false }: OrderCardProps) {
>>>>>>> /Users/beshnovski/.windsurf/worktrees/RenkFlow-Worktree/RenkFlow-Worktree-42fbda1e/RenkFlow/renkflow-nextjs/components/orders/OrderCard.tsx
  const { user } = useAuth();
  const statusInfo = getOrderStatusInfo(order.status);
  const colors = statusColors[order.status];
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: order.id, disabled: isDragOverlay });

  const style = isDragOverlay ? {} : {
    transform: CSS.Transform.toString(transform),
    transition: isDragging 
      ? 'none' 
      : transition || 'transform 250ms cubic-bezier(0.25, 1, 0.5, 1)',
    opacity: isDragging ? 0.5 : 1,
  };

  const progressWidth = order.status === 'pending' ? 'w-1/4' 
    : order.status === 'in_production' ? 'w-2/3' 
    : 'w-full';

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={style}
      {...(isDragOverlay ? {} : attributes)}
      {...(isDragOverlay ? {} : listeners)}
      className={`
        group relative overflow-hidden
        bg-white dark:bg-gray-900/95 rounded-xl p-4 
        border ${colors.border}
        cursor-grab active:cursor-grabbing
        transition-all duration-300 ease-out
        ${isDragging 
          ? 'shadow-2xl scale-[1.02] z-50 ring-2 ring-primary/40' 
          : 'shadow-sm hover:shadow-lg hover:-translate-y-0.5'
        }
        ${isDragOverlay ? 'shadow-2xl' : ''}
      `}
    >
      {/* Subtle gradient overlay */}
      <div className={`absolute inset-0 opacity-30 pointer-events-none bg-gradient-to-br ${colors.bg}`} />
      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <span className={`
              inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold
              ${colors.bg} ${colors.border} border
            `}>
              #{order.id.slice(-3)}
            </span>
            <div>
              <h4 className="font-semibold text-sm text-text-light dark:text-text-dark leading-tight">
                {order.customer}
              </h4>
              {order.product && (
                <p className="text-xs text-subtle-light dark:text-subtle-dark truncate max-w-[140px]">
                  {order.product}
                </p>
              )}
            </div>
          </div>
          <Link
            href={`/orders/${order.id}`}
            className="
              opacity-0 group-hover:opacity-100 transition-opacity duration-200
              p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800
              text-subtle-light dark:text-subtle-dark hover:text-primary
            "
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          </Link>
        </div>

        {/* Amount & Date Row */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-base font-bold text-text-light dark:text-text-dark">
            {formatCurrency(order.amount, order.currency)}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-subtle-light dark:text-subtle-dark">
            <span className="material-symbols-outlined text-[14px]">calendar_today</span>
            <span>{formatDate(order.date)}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative">
          <div className={`w-full h-1.5 rounded-full ${colors.progressBg}`}>
            <div
              className={`h-full rounded-full ${colors.progress} ${progressWidth} transition-all duration-500 ease-out`}
            />
          </div>
        </div>

        {/* Actions - Show on hover */}
        {user?.role === 'admin' && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={(e) => {
                e.stopPropagation();
                alert('Belge ekleme açılacak');
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-medium"
            >
              <span className="material-symbols-outlined text-[14px]">attach_file</span>
              Belge Ekle
            </button>
          </div>
        )}
      </div>
    </div>
  );
<<<<<<< /Users/beshnovski/RenkFlow V2/RenkFlow/renkflow-nextjs/components/orders/OrderCard.tsx
}

export const OrderCard = memo(OrderCardComponent);
=======
});
>>>>>>> /Users/beshnovski/.windsurf/worktrees/RenkFlow-Worktree/RenkFlow-Worktree-42fbda1e/RenkFlow/renkflow-nextjs/components/orders/OrderCard.tsx
