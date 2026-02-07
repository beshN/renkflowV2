'use client';

/**
 * Dashboard Widgets - Professional widget components
 * 
 * Features:
 * - Activity Feed: Real-time activity stream
 * - Quick Actions: Frequently used actions
 * - Performance Chart: Revenue/orders trend
 * - Alerts Widget: Critical notifications
 */

import React, { useMemo, memo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useMotionSafe } from '@/hooks/useReducedMotion';
import { Order, OrderStatus } from '@/lib/types';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { calculateOrderPriority, getAttentionRequired } from '@/lib/utils/dataGridUtils';
import {
  Bell,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Package,
  Plus,
  Search,
  FileText,
  Users,
  Settings,
  TrendingUp,
  ArrowRight,
  Calendar,
  Zap,
  Activity,
} from 'lucide-react';

// ============================================
// Activity Feed Widget
// ============================================

interface ActivityItem {
  id: string;
  type: 'order_created' | 'status_changed' | 'order_delivered' | 'note_added';
  order: Order;
  timestamp: Date;
  description: string;
}

interface ActivityFeedProps {
  orders: Order[];
  maxItems?: number;
}

const ActivityFeedComponent = ({ orders, maxItems = 8 }: ActivityFeedProps) => {
  const { prefersReducedMotion, transition } = useMotionSafe();
  
  const activities = useMemo(() => {
    const items: ActivityItem[] = orders.slice(0, maxItems).map(order => ({
      id: order.id,
      type: order.status === 'delivered' ? 'order_delivered' : 'order_created',
      order,
      timestamp: new Date(order.updatedAt || order.createdAt),
      description: order.status === 'delivered' 
        ? `${order.productName} teslim edildi`
        : `Yeni sipariş: ${order.productName}`,
    }));

    return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [orders, maxItems]);

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'order_created':
        return <Plus className="w-4 h-4 text-green-500" />;
      case 'status_changed':
        return <Activity className="w-4 h-4 text-blue-500" />;
      case 'order_delivered':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'note_added':
        return <FileText className="w-4 h-4 text-purple-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-1">
      <AnimatePresence>
        {activities.map((activity, index) => (
          <motion.div
            key={activity.id}
            initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
            transition={transition}
            className="group"
          >
            <Link
              href={`/orders/${activity.order.id}`}
              className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="mt-0.5 p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800">
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-white truncate">
                  {activity.description}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {activity.order.customerName} • {formatDate(activity.timestamp.toISOString())}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          </motion.div>
        ))}
      </AnimatePresence>

      {activities.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Henüz aktivite yok</p>
        </div>
      )}
    </div>
  );
};

export const ActivityFeed = memo(ActivityFeedComponent);

// ============================================
// Quick Actions Widget
// ============================================

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  shortcut?: string;
}

const defaultActions: QuickAction[] = [
  {
    id: 'new-order',
    label: 'Yeni Sipariş',
    icon: <Plus className="w-5 h-5" />,
    href: '/new-order',
    color: 'bg-blue-500 hover:bg-blue-600',
    shortcut: '⌘N',
  },
  {
    id: 'search',
    label: 'Sipariş Ara',
    icon: <Search className="w-5 h-5" />,
    href: '/search',
    color: 'bg-purple-500 hover:bg-purple-600',
    shortcut: '⌘K',
  },
  {
    id: 'kanban',
    label: 'Kanban',
    icon: <Package className="w-5 h-5" />,
    href: '/kanban',
    color: 'bg-emerald-500 hover:bg-emerald-600',
  },
  {
    id: 'reports',
    label: 'Raporlar',
    icon: <FileText className="w-5 h-5" />,
    href: '/reports',
    color: 'bg-amber-500 hover:bg-amber-600',
  },
  {
    id: 'team',
    label: 'Ekip',
    icon: <Users className="w-5 h-5" />,
    href: '/team',
    color: 'bg-pink-500 hover:bg-pink-600',
  },
  {
    id: 'settings',
    label: 'Ayarlar',
    icon: <Settings className="w-5 h-5" />,
    href: '/settings',
    color: 'bg-gray-500 hover:bg-gray-600',
  },
];

const QuickActionsComponent = ({ actions = defaultActions }: { actions?: QuickAction[] }) => {
  const prefersReducedMotion = useReducedMotion();
  
  return (
    <div className="grid grid-cols-3 gap-3">
      {actions.map((action, index) => (
        <motion.div
          key={action.id}
          initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.9 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05, ease: [0.4, 0, 0.2, 1] }}
          style={{ willChange: prefersReducedMotion ? 'auto' : 'transform, opacity' }}
        >
          <Link
            href={action.href}
            className={cn(
              'flex flex-col items-center justify-center p-4 rounded-2xl text-white transition-all',
              'hover:scale-105 hover:shadow-lg active:scale-95',
              action.color
            )}
          >
            {action.icon}
            <span className="mt-2 text-xs font-medium">{action.label}</span>
            {action.shortcut && (
              <span className="mt-1 text-[10px] opacity-70">{action.shortcut}</span>
            )}
          </Link>
        </motion.div>
      ))}
    </div>
  );
};

export const QuickActions = memo(QuickActionsComponent);

// ============================================
// Alerts Widget
// ============================================

interface AlertsWidgetProps {
  orders: Order[];
  maxAlerts?: number;
}

const AlertsWidgetComponent = ({ orders, maxAlerts = 5 }: AlertsWidgetProps) => {
  const alerts = useMemo(() => {
    const attentionOrders = getAttentionRequired(orders);
    
    return attentionOrders.slice(0, maxAlerts).map(order => {
      const priority = calculateOrderPriority(order);
      return {
        order,
        priority,
      };
    });
  }, [orders, maxAlerts]);

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
        <CheckCircle2 className="w-10 h-10 mb-3 text-green-500" />
        <p className="text-sm font-medium">Her şey yolunda!</p>
        <p className="text-xs mt-1">Kritik sipariş bulunmuyor</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map(({ order, priority }, index) => (
        <motion.div
          key={order.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05, ease: [0.4, 0, 0.2, 1] }}
          style={{ willChange: 'transform, opacity' }}
        >
          <Link
            href={`/orders/${order.id}`}
            className={cn(
              'block p-4 rounded-xl border-l-4 transition-all hover:shadow-md',
              priority.level === 'critical'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-500'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className={cn(
                  'w-4 h-4',
                  priority.level === 'critical' ? 'text-red-500' : 'text-amber-500'
                )} />
                <span className="font-medium text-sm text-gray-900 dark:text-white">
                  #{order.orderNumber || order.id.slice(0, 8)}
                </span>
              </div>
              <span className={cn(
                'px-2 py-0.5 text-xs font-medium rounded-full',
                priority.level === 'critical'
                  ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                  : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
              )}>
                {priority.level === 'critical' ? 'Kritik' : 'Yüksek'}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {order.productName}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {priority.reasons.slice(0, 2).map((reason, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 bg-white/50 dark:bg-gray-800/50 rounded-full text-gray-600 dark:text-gray-400"
                >
                  {reason}
                </span>
              ))}
            </div>
          </Link>
        </motion.div>
      ))}

      {alerts.length > 0 && (
        <Link
          href="/orders?priority=high"
          className="flex items-center justify-center gap-2 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          Tümünü Gör
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
};

export const AlertsWidget = memo(AlertsWidgetComponent);

// ============================================
// Upcoming Deliveries Widget
// ============================================

interface UpcomingDeliveriesProps {
  orders: Order[];
  days?: number;
}

const UpcomingDeliveriesComponent = ({ orders, days = 7 }: UpcomingDeliveriesProps) => {
  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + days);

    return orders
      .filter(order => {
        if (!order.deliveryDate || order.status === 'delivered') return false;
        const delivery = new Date(order.deliveryDate);
        return delivery >= today && delivery <= futureDate;
      })
      .sort((a, b) => {
        const dateA = new Date(a.deliveryDate!);
        const dateB = new Date(b.deliveryDate!);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 5);
  }, [orders, days]);

  const getDaysUntil = (date: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const delivery = new Date(date);
    delivery.setHours(0, 0, 0, 0);
    const diff = Math.ceil((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diff === 0) return 'Bugün';
    if (diff === 1) return 'Yarın';
    return `${diff} gün`;
  };

  if (upcoming.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
        <Calendar className="w-10 h-10 mb-3 opacity-50" />
        <p className="text-sm">Yaklaşan teslim yok</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {upcoming.map((order, index) => (
        <motion.div
          key={order.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.03, ease: [0.4, 0, 0.2, 1] }}
          style={{ willChange: 'transform, opacity' }}
        >
          <Link
            href={`/orders/${order.id}`}
            className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold',
                getDaysUntil(order.deliveryDate!) === 'Bugün'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                  : getDaysUntil(order.deliveryDate!) === 'Yarın'
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
              )}>
                {getDaysUntil(order.deliveryDate!)}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {order.productName}
                </p>
                <p className="text-xs text-gray-500">{order.customerName}</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        </motion.div>
      ))}
    </div>
  );
};

export const UpcomingDeliveries = memo(UpcomingDeliveriesComponent);

// ============================================
// Status Overview Widget
// ============================================

interface StatusOverviewProps {
  orders: Order[];
}

const StatusOverviewComponent = ({ orders }: StatusOverviewProps) => {
  const stats = useMemo(() => {
    const pending = orders.filter(o => o.status === 'pending').length;
    const inProduction = orders.filter(o => o.status === 'in_production').length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const total = orders.length;

    return [
      { label: 'Beklemede', count: pending, color: 'bg-amber-500', percentage: (pending / total) * 100 },
      { label: 'Üretimde', count: inProduction, color: 'bg-blue-500', percentage: (inProduction / total) * 100 },
      { label: 'Teslim', count: delivered, color: 'bg-emerald-500', percentage: (delivered / total) * 100 },
    ];
  }, [orders]);

  return (
    <div className="space-y-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {stat.label}
            </span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {stat.count}
            </span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full', stat.color)}
              initial={{ width: 0 }}
              animate={{ width: `${stat.percentage || 0}%` }}
              transition={{ duration: 0.6, delay: index * 0.08, ease: [0.4, 0, 0.2, 1] }}
              style={{ transform: 'translateZ(0)', willChange: 'width' }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export const StatusOverview = memo(StatusOverviewComponent);

export default {
  ActivityFeed,
  QuickActions,
  AlertsWidget,
  UpcomingDeliveries,
  StatusOverview,
};
