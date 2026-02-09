import { Order } from '@/lib/types';

export type OrderRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface OrderRiskAssessment {
  level: OrderRiskLevel;
  score: number;
  isOverdue: boolean;
  daysToDeadline: number;
  overdueDays: number;
  statusAgeDays: number;
  recommendedAction: string;
  effectiveDeadline: string;
  usesEstimatedDeadline: boolean;
}

export interface OrderHealthSummary {
  totalOrders: number;
  activeOrders: number;
  overdueCount: number;
  dueSoonCount: number;
  atRiskCount: number;
  criticalCount: number;
  averageRiskScore: number;
  byLevel: Record<OrderRiskLevel, number>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function diffDays(from: Date, to: Date): number {
  return Math.ceil((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(Math.round(score), 100));
}

function estimatedLeadTimeDays(order: Order): number {
  const quantity = order.quantity || 1;
  let base = 3;

  if (quantity > 500) base = 10;
  else if (quantity > 100) base = 7;
  else if (quantity > 25) base = 5;

  if (order.priority === 'high') base = Math.max(2, base - 1);
  if (order.priority === 'urgent') base = Math.max(1, base - 2);

  return base;
}

function resolveDeadline(order: Order): { date: Date; usesEstimatedDeadline: boolean } {
  const explicit = parseDate(order.deliveryDate);
  if (explicit) {
    return {
      date: startOfDay(explicit),
      usesEstimatedDeadline: false,
    };
  }

  const createdAt = parseDate(order.createdAt) || new Date();
  const deadline = new Date(startOfDay(createdAt).getTime() + estimatedLeadTimeDays(order) * DAY_MS);
  return {
    date: deadline,
    usesEstimatedDeadline: true,
  };
}

function recommendedAction(
  order: Order,
  level: OrderRiskLevel,
  isOverdue: boolean,
  daysToDeadline: number
): string {
  if (order.status === 'delivered') return 'Tamamlandı';
  if (isOverdue && level === 'critical') return 'Acil müdahale: kapasite artır ve müşteri bilgilendir';
  if (isOverdue) return 'Teslim planını güncelle ve gecikme bildirimini gönder';
  if (daysToDeadline <= 1 && order.status === 'pending') return 'Önceliklendir: üretime hemen al';
  if (level === 'high') return 'Günlük takip ve blokaj temizliği başlat';
  if (level === 'medium') return 'Haftalık planı revize et ve WIP dengesini kontrol et';
  return 'Akış normal: standart takip';
}

export function assessOrderRisk(order: Order, now: Date = new Date()): OrderRiskAssessment {
  if (order.status === 'delivered') {
    const deliveredDeadline = resolveDeadline(order);
    return {
      level: 'low',
      score: 0,
      isOverdue: false,
      daysToDeadline: diffDays(now, deliveredDeadline.date),
      overdueDays: 0,
      statusAgeDays: 0,
      recommendedAction: 'Tamamlandı',
      effectiveDeadline: deliveredDeadline.date.toISOString(),
      usesEstimatedDeadline: deliveredDeadline.usesEstimatedDeadline,
    };
  }

  const deadline = resolveDeadline(order);
  const daysToDeadline = diffDays(now, deadline.date);
  const overdueDays = Math.max(-daysToDeadline, 0);
  const isOverdue = overdueDays > 0;

  const statusAnchor = parseDate(order.updatedAt) || parseDate(order.createdAt) || now;
  const statusAgeDays = Math.max(0, diffDays(statusAnchor, now));

  let score = 0;

  if (isOverdue) {
    score += 60 + Math.min(30, overdueDays * 8);
  } else if (daysToDeadline <= 0) {
    score += 55;
  } else if (daysToDeadline <= 1) {
    score += 42;
  } else if (daysToDeadline <= 3) {
    score += 28;
  } else if (daysToDeadline <= 7) {
    score += 12;
  }

  if (order.status === 'pending') {
    if (statusAgeDays >= 4) score += 20;
    else if (statusAgeDays >= 2) score += 10;
  }

  if (order.status === 'in_production') {
    if (statusAgeDays >= 9) score += 22;
    else if (statusAgeDays >= 6) score += 12;
  }

  if (order.priority === 'high') score += 8;
  if (order.priority === 'urgent') score += 14;
  if (order.totalAmount >= 100000) score += 10;
  else if (order.totalAmount >= 50000) score += 6;

  const normalizedScore = clampScore(score);

  let level: OrderRiskLevel = 'low';
  if (normalizedScore >= 80) level = 'critical';
  else if (normalizedScore >= 60) level = 'high';
  else if (normalizedScore >= 35) level = 'medium';

  return {
    level,
    score: normalizedScore,
    isOverdue,
    daysToDeadline,
    overdueDays,
    statusAgeDays,
    recommendedAction: recommendedAction(order, level, isOverdue, daysToDeadline),
    effectiveDeadline: deadline.date.toISOString(),
    usesEstimatedDeadline: deadline.usesEstimatedDeadline,
  };
}

export function getOrderHealthSummary(orders: Order[], now: Date = new Date()): OrderHealthSummary {
  const byLevel: Record<OrderRiskLevel, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  let overdueCount = 0;
  let dueSoonCount = 0;
  let atRiskCount = 0;
  let criticalCount = 0;
  let scoreTotal = 0;
  let activeOrders = 0;

  for (const order of orders) {
    const risk = assessOrderRisk(order, now);
    byLevel[risk.level] += 1;

    if (order.status !== 'delivered') {
      activeOrders += 1;
      scoreTotal += risk.score;
      if (risk.isOverdue) overdueCount += 1;
      if (!risk.isOverdue && risk.daysToDeadline <= 2) dueSoonCount += 1;
      if (risk.level === 'high' || risk.level === 'critical') atRiskCount += 1;
      if (risk.level === 'critical') criticalCount += 1;
    }
  }

  return {
    totalOrders: orders.length,
    activeOrders,
    overdueCount,
    dueSoonCount,
    atRiskCount,
    criticalCount,
    averageRiskScore: activeOrders > 0 ? Math.round(scoreTotal / activeOrders) : 0,
    byLevel,
  };
}

export function getTopRiskOrders(
  orders: Order[],
  limit: number = 5,
  now: Date = new Date()
): Array<{ order: Order; risk: OrderRiskAssessment }> {
  return orders
    .filter((order) => order.status !== 'delivered')
    .map((order) => ({ order, risk: assessOrderRisk(order, now) }))
    .sort((a, b) => {
      if (b.risk.score !== a.risk.score) return b.risk.score - a.risk.score;
      if (b.risk.overdueDays !== a.risk.overdueDays) return b.risk.overdueDays - a.risk.overdueDays;
      return a.risk.daysToDeadline - b.risk.daysToDeadline;
    })
    .slice(0, limit);
}
