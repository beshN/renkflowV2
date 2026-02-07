import { memo, useMemo, useState, type MouseEvent, type PointerEvent } from 'react';
import Link from 'next/link';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Order } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { MoreVertical, Eye, Edit, Copy, Trash2, Calendar, Paperclip, GripVertical } from 'lucide-react';

interface OrderCardProps {
  order: Order;
  onDelete?: (id: string) => void;
  isDragOverlay?: boolean;
}

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

export const OrderCard = memo(function OrderCard({ order, onDelete, isDragOverlay = false }: OrderCardProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const colors = statusColors[order.status];
  const [menuOpen, setMenuOpen] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
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

  const priorityConfig = {
    low: { label: 'Düşük', className: 'bg-slate-100 text-slate-600 border-slate-200' },
    medium: { label: 'Orta', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    high: { label: 'Yüksek', className: 'bg-orange-100 text-orange-700 border-orange-200' },
    urgent: { label: 'Acil', className: 'bg-red-100 text-red-700 border-red-200 animate-pulse' },
  } as const;

  const deliveryInfo = useMemo(() => {
    if (!order.deliveryDate) return null;
    const diffMs = new Date(order.deliveryDate).getTime() - Date.now();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (Number.isNaN(days)) return null;
    if (days < 0) {
      return { label: `${Math.abs(days)} gün gecikme`, tone: 'text-red-600' };
    }
    if (days === 0) {
      return { label: 'Bugün teslim', tone: 'text-amber-600' };
    }
    if (days <= 3) {
      return { label: `${days} gün kaldı`, tone: 'text-amber-600' };
    }
    return { label: `${days} gün kaldı`, tone: 'text-slate-500' };
  }, [order.deliveryDate]);

  const priority = useMemo<keyof typeof priorityConfig>(() => {
    if (order.priority) return order.priority;
    if (deliveryInfo?.label?.includes('gecikme') || deliveryInfo?.label === 'Bugün teslim') return 'urgent';
    if (order.totalAmount > 20000) return 'high';
    if (order.totalAmount > 10000) return 'medium';
    return 'low';
  }, [order.priority, order.totalAmount, deliveryInfo]);

  const handleCopyId = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(order.id);
      showToast('Sipariş ID kopyalandı', 'success');
    }
    setMenuOpen(false);
  };

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={style}
      className={`
        group relative overflow-hidden
        bg-white dark:bg-gray-900/95 rounded-xl p-4 
        border ${colors.border}
        cursor-default
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
              #{(order.orderNumber || order.id).slice(-3)}
            </span>
            <div>
              <h4 className="font-semibold text-sm text-text-light dark:text-text-dark leading-tight">
                {order.customerName}
              </h4>
              {order.productName && (
                <p className="text-xs text-subtle-light dark:text-subtle-dark truncate max-w-[140px]">
                  {order.productName}
                </p>
              )}
            </div>
          </div>
          {!isDragOverlay && (
            <div className="relative flex items-center gap-1">
              <button
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
                onPointerDown={(e: PointerEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                }}
                aria-label="Siparişi sürükle"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-grab active:cursor-grabbing touch-none"
              >
                <GripVertical size={16} />
              </button>

              <button
                onClick={(e: MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  setMenuOpen((prev) => !prev);
                }}
                onPointerDown={(e: PointerEvent<HTMLButtonElement>) => e.stopPropagation()}
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-subtle-light dark:text-subtle-dark hover:text-primary"
              >
                <MoreVertical size={18} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-40 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl z-20">
                  <Link
                    href={`/orders/${order.id}`}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-t-xl"
                    onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                    }}
                    onPointerDown={(e: PointerEvent<HTMLAnchorElement>) => e.stopPropagation()}
                  >
                    <Eye size={16} />
                    Görüntüle
                  </Link>
                  <Link
                    href={`/orders/${order.id}?edit=true`}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                    }}
                    onPointerDown={(e: PointerEvent<HTMLAnchorElement>) => e.stopPropagation()}
                  >
                    <Edit size={16} />
                    Düzenle
                  </Link>
                  <button
                    onClick={handleCopyId}
                    onPointerDown={(e: PointerEvent<HTMLButtonElement>) => e.stopPropagation()}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Copy size={16} />
                    ID Kopyala
                  </button>
                  {onDelete && (user?.role === 'admin' || user?.role === 'owner') && (
                    <button
                      onClick={(e: MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        onDelete(order.id);
                        setMenuOpen(false);
                      }}
                      onPointerDown={(e: PointerEvent<HTMLButtonElement>) => e.stopPropagation()}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-xl"
                    >
                      <Trash2 size={16} />
                      Sil
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Amount & Date Row */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-base font-bold text-text-light dark:text-text-dark">
            {formatCurrency(order.totalAmount, order.currency)}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-subtle-light dark:text-subtle-dark">
            <Calendar size={14} />
            <span>{formatDate(order.date)}</span>
          </div>
        </div>

        {/* Priority + Delivery */}
        <div className="flex items-center justify-between mb-3">
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${priorityConfig[priority].className}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
            {priorityConfig[priority].label}
          </span>
          {deliveryInfo && (
            <span className={`text-[10px] font-semibold ${deliveryInfo.tone}`}>
              {deliveryInfo.label}
            </span>
          )}
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
              onClick={(e: React.MouseEvent<HTMLElement>) => {
                e.stopPropagation();
                showToast('Belge yükleme için sipariş detayına gidin', 'info');
              }}
              onPointerDown={(e: React.PointerEvent<HTMLElement>) => e.stopPropagation()}
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-medium"
            >
              <Paperclip size={14} />
              Belge Ekle
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
