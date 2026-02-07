'use client';

/**
 * OrderTimeline - Professional workflow visualization
 * 
 * Features:
 * - Visual order status history
 * - Activity feed with timestamps
 * - User attribution
 * - Notes and comments
 * - Animated transitions
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Order, OrderStatus } from '@/lib/types';
import { formatDate, cn } from '@/lib/utils';
import {
  Clock,
  Package,
  Truck,
  CheckCircle2,
  AlertCircle,
  User,
  MessageSquare,
  FileText,
  Edit,
  ArrowRight,
  Calendar,
  DollarSign,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface TimelineEvent {
  id: string;
  type: 'status_change' | 'note_added' | 'document_uploaded' | 'amount_updated' | 'created' | 'delivered';
  timestamp: Date;
  user?: {
    name: string;
    avatar?: string;
  };
  data: {
    fromStatus?: OrderStatus;
    toStatus?: OrderStatus;
    note?: string;
    fileName?: string;
    oldAmount?: number;
    newAmount?: number;
  };
}

interface OrderTimelineProps {
  order: Order;
  events?: TimelineEvent[];
  variant?: 'full' | 'compact' | 'mini';
  showConnector?: boolean;
}

// ============================================
// Status Config
// ============================================

const statusConfig: Record<OrderStatus, {
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  pending: {
    label: 'Beklemede',
    icon: <Clock className="w-4 h-4" />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    borderColor: 'border-amber-500',
  },
  in_production: {
    label: 'Üretimde',
    icon: <Package className="w-4 h-4" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    borderColor: 'border-blue-500',
  },
  delivered: {
    label: 'Teslim Edildi',
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    borderColor: 'border-green-500',
  },
};

const eventTypeConfig: Record<TimelineEvent['type'], {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}> = {
  status_change: {
    icon: <ArrowRight className="w-3.5 h-3.5" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  note_added: {
    icon: <MessageSquare className="w-3.5 h-3.5" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
  document_uploaded: {
    icon: <FileText className="w-3.5 h-3.5" />,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
  },
  amount_updated: {
    icon: <DollarSign className="w-3.5 h-3.5" />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  created: {
    icon: <Calendar className="w-3.5 h-3.5" />,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  },
  delivered: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
};

// ============================================
// Status Progress Bar
// ============================================

const StatusProgressBar: React.FC<{ currentStatus: OrderStatus }> = ({ currentStatus }) => {
  const statuses: OrderStatus[] = ['pending', 'in_production', 'delivered'];
  const currentIndex = statuses.indexOf(currentStatus);

  return (
    <div className="flex items-center gap-2 p-4 glass-panel rounded-xl">
      {statuses.map((status, index) => {
        const config = statusConfig[status];
        const isActive = index <= currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <React.Fragment key={status}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
                isActive ? config.bgColor : 'bg-gray-200 dark:bg-gray-700',
                isCurrent && 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900',
                isCurrent && config.borderColor.replace('border-', 'ring-')
              )}
            >
              <div className={cn(
                'transition-colors',
                isActive ? config.color : 'text-gray-400'
              )}>
                {config.icon}
              </div>
              <span className={cn(
                'text-sm font-medium transition-colors',
                isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400'
              )}>
                {config.label}
              </span>
            </motion.div>
            {index < statuses.length - 1 && (
              <div className={cn(
                'flex-1 h-0.5 rounded-full transition-colors',
                index < currentIndex ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ============================================
// Timeline Event Item
// ============================================

const TimelineEventItem: React.FC<{
  event: TimelineEvent;
  isLast: boolean;
  variant: 'full' | 'compact' | 'mini';
}> = ({ event, isLast, variant }) => {
  const config = eventTypeConfig[event.type];

  const renderEventContent = () => {
    switch (event.type) {
      case 'status_change':
        const fromConfig = event.data.fromStatus ? statusConfig[event.data.fromStatus] : null;
        const toConfig = event.data.toStatus ? statusConfig[event.data.toStatus] : null;
        return (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-600 dark:text-gray-300">Durum değişti:</span>
            {fromConfig && (
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', fromConfig.bgColor, fromConfig.color)}>
                {fromConfig.label}
              </span>
            )}
            <ArrowRight className="w-3 h-3 text-gray-400" />
            {toConfig && (
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', toConfig.bgColor, toConfig.color)}>
                {toConfig.label}
              </span>
            )}
          </div>
        );
      case 'note_added':
        return (
          <div>
            <span className="text-gray-600 dark:text-gray-300">Not eklendi</span>
            {event.data.note && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-2 rounded-lg">
                "{event.data.note}"
              </p>
            )}
          </div>
        );
      case 'document_uploaded':
        return (
          <div className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-300">Dosya yüklendi:</span>
            <span className="text-blue-600 dark:text-blue-400 font-medium">{event.data.fileName}</span>
          </div>
        );
      case 'amount_updated':
        return (
          <div className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-300">Tutar güncellendi:</span>
            <span className="line-through text-gray-400">₺{event.data.oldAmount?.toLocaleString('tr-TR')}</span>
            <ArrowRight className="w-3 h-3 text-gray-400" />
            <span className="font-medium text-green-600">₺{event.data.newAmount?.toLocaleString('tr-TR')}</span>
          </div>
        );
      case 'created':
        return <span className="text-gray-600 dark:text-gray-300">Sipariş oluşturuldu</span>;
      case 'delivered':
        return <span className="text-green-600 dark:text-green-400 font-medium">Sipariş teslim edildi</span>;
      default:
        return null;
    }
  };

  if (variant === 'mini') {
    return (
      <div className="flex items-center gap-2 text-xs">
        <div className={cn('w-5 h-5 rounded-full flex items-center justify-center', config.bgColor, config.color)}>
          {config.icon}
        </div>
        <span className="text-gray-500">{formatDate(event.timestamp.toISOString())}</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="relative flex gap-4"
    >
      {/* Timeline Line */}
      {!isLast && (
        <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
      )}

      {/* Event Icon */}
      <div className={cn(
        'relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
        config.bgColor, config.color
      )}>
        {config.icon}
      </div>

      {/* Event Content */}
      <div className="flex-1 pb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="text-sm">{renderEventContent()}</div>
          <time className="text-xs text-gray-400 whitespace-nowrap">
            {formatDate(event.timestamp.toISOString())}
          </time>
        </div>
        {event.user && variant === 'full' && (
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              {event.user.avatar ? (
                <img src={event.user.avatar} alt="" className="w-full h-full rounded-full" />
              ) : (
                <User className="w-3 h-3 text-gray-400" />
              )}
            </div>
            <span>{event.user.name}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ============================================
// Main Component
// ============================================

export function OrderTimeline({
  order,
  events = [],
  variant = 'full',
  showConnector = true,
}: OrderTimelineProps) {
  // Generate events from order if not provided
  const timelineEvents = useMemo(() => {
    if (events.length > 0) return events;

    const generated: TimelineEvent[] = [
      {
        id: '1',
        type: 'created',
        timestamp: new Date(order.createdAt),
        data: {},
      },
    ];

    if (order.status === 'in_production' || order.status === 'delivered') {
      generated.push({
        id: '2',
        type: 'status_change',
        timestamp: new Date(order.updatedAt || order.createdAt),
        data: { fromStatus: 'pending', toStatus: 'in_production' },
      });
    }

    if (order.status === 'delivered') {
      generated.push({
        id: '3',
        type: 'delivered',
        timestamp: new Date(order.updatedAt || order.createdAt),
        data: { fromStatus: 'in_production', toStatus: 'delivered' },
      });
    }

    if (order.notes) {
      generated.push({
        id: '4',
        type: 'note_added',
        timestamp: new Date(order.createdAt),
        data: { note: order.notes },
      });
    }

    return generated.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [order, events]);

  if (variant === 'mini') {
    return (
      <div className="flex items-center gap-3 overflow-x-auto py-2">
        {timelineEvents.slice(0, 5).map((event, index) => (
          <TimelineEventItem
            key={event.id}
            event={event}
            isLast={index === timelineEvents.length - 1}
            variant="mini"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      {showConnector && <StatusProgressBar currentStatus={order.status} />}

      {/* Timeline Events */}
      <div className="space-y-0">
        {timelineEvents.map((event, index) => (
          <TimelineEventItem
            key={event.id}
            event={event}
            isLast={index === timelineEvents.length - 1}
            variant={variant}
          />
        ))}
      </div>

      {/* Empty State */}
      {timelineEvents.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Henüz aktivite yok</p>
        </div>
      )}
    </div>
  );
}

export default OrderTimeline;
