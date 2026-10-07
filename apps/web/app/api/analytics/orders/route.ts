import { apiContextWithPermission } from '@/lib/features/auth/api-access';
import { NextResponse } from 'next/server';
import { getOrderMetrics } from '@/lib/analytics/reporting';
import { orderService } from '@/lib/services/orderService.server';
import { getOrderHealthSummary, getTopRiskOrders } from '@/lib/features/orders/orderHealth';

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

export async function GET(request: Request) {
  const { context, denied } = await apiContextWithPermission('reports.view');
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const endDate = parseDate(searchParams.get('endDate'), new Date());
  const startDate = parseDate(
    searchParams.get('startDate'),
    new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
  );

  const [data, orders] = await Promise.all([
    getOrderMetrics(context.tenantId, { startDate, endDate }),
    orderService.getOrders(context.tenantId),
  ]);

  const healthSummary = getOrderHealthSummary(orders);
  const topRiskOrders = getTopRiskOrders(orders, 5).map(({ order, risk }) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    productName: order.productName,
    status: order.status,
    deliveryDate: order.deliveryDate,
    risk,
  }));

  return NextResponse.json({ success: true, data, healthSummary, topRiskOrders });
}
