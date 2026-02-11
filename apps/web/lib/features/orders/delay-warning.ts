import 'server-only';

import { sql } from '@/lib/db';
import { OrderStatus } from '@/lib/types';

type DelayWarningOrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  status: OrderStatus;
  created_at: string;
  delivery_date: string | null;
  total_amount: string | number;
};

export type DelayRiskLevel = 'on_track' | 'at_risk' | 'delayed';

export type DelayWarning = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  status: OrderStatus;
  predictedDelayDays: number;
  progressGapPercent: number;
  riskLevel: DelayRiskLevel;
  recommendation: string;
  deliveryDate: string | null;
};

const STATUS_PROGRESS_MAP: Record<OrderStatus, number> = {
  pending: 0.2,
  in_production: 0.65,
  delivered: 1,
};

function getRecommendation(riskLevel: DelayRiskLevel, status: OrderStatus): string {
  if (riskLevel === 'delayed' && status === 'pending') {
    return 'İşi üretime alıp planlanan başlangıcı öne çekin';
  }
  if (riskLevel === 'delayed' && status === 'in_production') {
    return 'İstasyon kapasitesini artırın ve darboğazı temizleyin';
  }
  if (riskLevel === 'at_risk') {
    return 'Vardiya ve teslim planını günlük olarak yeniden dengeleyin';
  }
  return 'Planlanan akış korunuyor';
}

export function estimateDelayWarning(order: {
  id: string;
  orderNumber: string;
  customerName: string;
  status: OrderStatus;
  createdAt: Date;
  deliveryDate: Date | null;
}): DelayWarning {
  if (!order.deliveryDate || order.status === 'delivered') {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      status: order.status,
      predictedDelayDays: 0,
      progressGapPercent: 0,
      riskLevel: 'on_track',
      recommendation: getRecommendation('on_track', order.status),
      deliveryDate: order.deliveryDate ? order.deliveryDate.toISOString() : null,
    };
  }

  const now = new Date();
  const msInDay = 1000 * 60 * 60 * 24;
  const totalPlannedDays = Math.max(1, (order.deliveryDate.getTime() - order.createdAt.getTime()) / msInDay);
  const elapsedDays = Math.max(0, (now.getTime() - order.createdAt.getTime()) / msInDay);

  const expectedProgress = Math.min(1, elapsedDays / totalPlannedDays);
  const actualProgress = STATUS_PROGRESS_MAP[order.status] || 0;
  const progressGap = Math.max(0, expectedProgress - actualProgress);

  const predictedDelayDays = Number((progressGap * totalPlannedDays).toFixed(1));
  const progressGapPercent = Number((progressGap * 100).toFixed(1));

  let riskLevel: DelayRiskLevel = 'on_track';
  if (predictedDelayDays >= 2) {
    riskLevel = 'delayed';
  } else if (predictedDelayDays > 0) {
    riskLevel = 'at_risk';
  }

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    status: order.status,
    predictedDelayDays,
    progressGapPercent,
    riskLevel,
    recommendation: getRecommendation(riskLevel, order.status),
    deliveryDate: order.deliveryDate.toISOString(),
  };
}

export async function listDelayWarnings(tenantId: string, limit: number = 30): Promise<{
  total: number;
  atRisk: number;
  delayed: number;
  items: DelayWarning[];
}> {
  const rows = await sql`
    SELECT
      id,
      order_number,
      customer_name,
      status,
      created_at,
      delivery_date,
      total_amount
    FROM orders
    WHERE tenant_id = ${tenantId}
      AND status IN ('pending', 'in_production')
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;

  const parsedRows = rows as DelayWarningOrderRow[];
  const warnings = parsedRows.map((row) =>
    estimateDelayWarning({
      id: row.id,
      orderNumber: row.order_number,
      customerName: row.customer_name,
      status: row.status,
      createdAt: new Date(row.created_at),
      deliveryDate: row.delivery_date ? new Date(row.delivery_date) : null,
    })
  );

  const items = warnings
    .filter((item) => item.riskLevel !== 'on_track')
    .sort((a, b) => b.predictedDelayDays - a.predictedDelayDays);

  return {
    total: warnings.length,
    atRisk: items.filter((item) => item.riskLevel === 'at_risk').length,
    delayed: items.filter((item) => item.riskLevel === 'delayed').length,
    items,
  };
}
