/**
 * DataGrid Utilities - Professional data grid helpers
 * 
 * Features:
 * - Conditional row styling based on order state
 * - Row grouping by customer/product/status
 * - Priority calculation
 * - Data transformations
 */

import { Order, OrderStatus } from '@/lib/types';

// ============================================
// Conditional Row Styling
// ============================================

export interface RowStyle {
  className: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  priority: number;
}

export interface ConditionalStyleRule {
  id: string;
  name: string;
  condition: (order: Order) => boolean;
  style: RowStyle;
}

/**
 * Default conditional styling rules
 */
export const defaultStyleRules: ConditionalStyleRule[] = [
  {
    id: 'overdue',
    name: 'Gecikmiş Siparişler',
    condition: (order) => {
      if (!order.deliveryDate || order.status === 'delivered') return false;
      return new Date(order.deliveryDate) < new Date();
    },
    style: {
      className: 'bg-red-50 dark:bg-red-900/20 border-l-4 border-l-red-500',
      priority: 100,
    },
  },
  {
    id: 'due-today',
    name: 'Bugün Teslim',
    condition: (order) => {
      if (!order.deliveryDate || order.status === 'delivered') return false;
      const today = new Date();
      const delivery = new Date(order.deliveryDate);
      return delivery.toDateString() === today.toDateString();
    },
    style: {
      className: 'bg-amber-50 dark:bg-amber-900/20 border-l-4 border-l-amber-500',
      priority: 90,
    },
  },
  {
    id: 'due-this-week',
    name: 'Bu Hafta Teslim',
    condition: (order) => {
      if (!order.deliveryDate || order.status === 'delivered') return false;
      const today = new Date();
      const delivery = new Date(order.deliveryDate);
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() + 7);
      return delivery > today && delivery <= weekEnd;
    },
    style: {
      className: 'bg-blue-50 dark:bg-blue-900/10 border-l-4 border-l-blue-400',
      priority: 50,
    },
  },
  {
    id: 'high-value',
    name: 'Yüksek Değerli (₺10.000+)',
    condition: (order) => order.totalAmount >= 10000,
    style: {
      className: 'bg-purple-50 dark:bg-purple-900/10',
      priority: 30,
    },
  },
  {
    id: 'new-order',
    name: 'Yeni Sipariş (24 saat)',
    condition: (order) => {
      const created = new Date(order.createdAt);
      const dayAgo = new Date();
      dayAgo.setDate(dayAgo.getDate() - 1);
      return created > dayAgo;
    },
    style: {
      className: 'ring-2 ring-green-200 dark:ring-green-800 ring-inset',
      priority: 20,
    },
  },
  {
    id: 'pending-long',
    name: 'Uzun Süredir Bekleyen',
    condition: (order) => {
      if (order.status !== 'pending') return false;
      const created = new Date(order.createdAt);
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      return created < threeDaysAgo;
    },
    style: {
      className: 'bg-orange-50 dark:bg-orange-900/10 border-l-4 border-l-orange-400',
      priority: 60,
    },
  },
];

/**
 * Get row style for an order based on conditional rules
 */
export function getRowStyle(
  order: Order,
  rules: ConditionalStyleRule[] = defaultStyleRules
): RowStyle | null {
  const matchingRules = rules
    .filter(rule => rule.condition(order))
    .sort((a, b) => b.style.priority - a.style.priority);

  return matchingRules[0]?.style || null;
}

/**
 * Get all matching rules for an order
 */
export function getMatchingRules(
  order: Order,
  rules: ConditionalStyleRule[] = defaultStyleRules
): ConditionalStyleRule[] {
  return rules.filter(rule => rule.condition(order));
}

// ============================================
// Row Grouping
// ============================================

export type GroupByField = 'customerName' | 'productName' | 'status' | 'deliveryDate' | 'none';

export interface OrderGroup {
  id: string;
  label: string;
  orders: Order[];
  count: number;
  totalAmount: number;
  isExpanded: boolean;
}

/**
 * Group orders by a specific field
 */
export function groupOrdersBy(
  orders: Order[],
  groupBy: GroupByField
): OrderGroup[] {
  if (groupBy === 'none') {
    return [{
      id: 'all',
      label: 'Tüm Siparişler',
      orders,
      count: orders.length,
      totalAmount: orders.reduce((sum, o) => sum + o.totalAmount, 0),
      isExpanded: true,
    }];
  }

  const groups = new Map<string, Order[]>();

  orders.forEach(order => {
    let key: string;

    switch (groupBy) {
      case 'customerName':
        key = order.customerName || 'Bilinmeyen Müşteri';
        break;
      case 'productName':
        key = order.productName || 'Bilinmeyen Ürün';
        break;
      case 'status':
        key = order.status;
        break;
      case 'deliveryDate':
        key = order.deliveryDate 
          ? new Date(order.deliveryDate).toLocaleDateString('tr-TR')
          : 'Tarih Belirtilmemiş';
        break;
      default:
        key = 'other';
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(order);
  });

  return Array.from(groups.entries())
    .map(([key, groupOrders]) => ({
      id: key,
      label: groupBy === 'status' ? getStatusLabel(key as OrderStatus) : key,
      orders: groupOrders,
      count: groupOrders.length,
      totalAmount: groupOrders.reduce((sum, o) => sum + o.totalAmount, 0),
      isExpanded: true,
    }))
    .sort((a, b) => {
      // Sort by count for most fields, or by date for deliveryDate
      if (groupBy === 'deliveryDate') {
        return a.label.localeCompare(b.label);
      }
      return b.count - a.count;
    });
}

function getStatusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    pending: 'Beklemede',
    in_production: 'Üretimde',
    delivered: 'Teslim Edildi',
  };
  return labels[status] || status;
}

// ============================================
// Priority Calculation
// ============================================

export interface OrderPriority {
  score: number;
  level: 'critical' | 'high' | 'medium' | 'low';
  reasons: string[];
}

/**
 * Calculate order priority based on multiple factors
 */
export function calculateOrderPriority(order: Order): OrderPriority {
  let score = 0;
  const reasons: string[] = [];

  // Overdue check
  if (order.deliveryDate && order.status !== 'delivered') {
    const daysUntilDelivery = Math.ceil(
      (new Date(order.deliveryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilDelivery < 0) {
      score += 100;
      reasons.push(`${Math.abs(daysUntilDelivery)} gün gecikmiş`);
    } else if (daysUntilDelivery === 0) {
      score += 80;
      reasons.push('Bugün teslim edilmeli');
    } else if (daysUntilDelivery <= 3) {
      score += 60;
      reasons.push(`${daysUntilDelivery} gün kaldı`);
    } else if (daysUntilDelivery <= 7) {
      score += 30;
      reasons.push('Bu hafta teslim');
    }
  }

  // High value orders
  if (order.totalAmount >= 50000) {
    score += 30;
    reasons.push('Çok yüksek değerli sipariş');
  } else if (order.totalAmount >= 10000) {
    score += 15;
    reasons.push('Yüksek değerli sipariş');
  }

  // Long pending
  if (order.status === 'pending') {
    const daysSinceCreated = Math.ceil(
      (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceCreated > 5) {
      score += 40;
      reasons.push(`${daysSinceCreated} gündür bekliyor`);
    } else if (daysSinceCreated > 2) {
      score += 20;
      reasons.push('Uzun süredir bekliyor');
    }
  }

  // Determine level
  let level: OrderPriority['level'];
  if (score >= 80) {
    level = 'critical';
  } else if (score >= 50) {
    level = 'high';
  } else if (score >= 20) {
    level = 'medium';
  } else {
    level = 'low';
  }

  return { score, level, reasons };
}

// ============================================
// Data Transformations
// ============================================

/**
 * Sort orders by priority
 */
export function sortByPriority(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    const priorityA = calculateOrderPriority(a).score;
    const priorityB = calculateOrderPriority(b).score;
    return priorityB - priorityA;
  });
}

/**
 * Get orders requiring attention
 */
export function getAttentionRequired(orders: Order[]): Order[] {
  return orders.filter(order => {
    const priority = calculateOrderPriority(order);
    return priority.level === 'critical' || priority.level === 'high';
  });
}

/**
 * Calculate summary statistics
 */
export interface OrdersSummary {
  total: number;
  byStatus: Record<OrderStatus, number>;
  totalRevenue: number;
  averageValue: number;
  overdueCount: number;
  dueTodayCount: number;
  criticalCount: number;
}

export function calculateSummary(orders: Order[]): OrdersSummary {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const summary: OrdersSummary = {
    total: orders.length,
    byStatus: {
      pending: 0,
      in_production: 0,
      delivered: 0,
    },
    totalRevenue: 0,
    averageValue: 0,
    overdueCount: 0,
    dueTodayCount: 0,
    criticalCount: 0,
  };

  orders.forEach(order => {
    summary.byStatus[order.status]++;
    summary.totalRevenue += order.totalAmount;

    if (order.deliveryDate && order.status !== 'delivered') {
      const delivery = new Date(order.deliveryDate);
      delivery.setHours(0, 0, 0, 0);

      if (delivery < today) {
        summary.overdueCount++;
      } else if (delivery.getTime() === today.getTime()) {
        summary.dueTodayCount++;
      }
    }

    if (calculateOrderPriority(order).level === 'critical') {
      summary.criticalCount++;
    }
  });

  summary.averageValue = orders.length > 0 
    ? summary.totalRevenue / orders.length 
    : 0;

  return summary;
}

export default {
  getRowStyle,
  getMatchingRules,
  groupOrdersBy,
  calculateOrderPriority,
  sortByPriority,
  getAttentionRequired,
  calculateSummary,
  defaultStyleRules,
};
