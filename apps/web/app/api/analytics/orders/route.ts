import { getServerUserContext, AuthenticationError, AuthorizationError, requirePermission } from '@/lib/features/auth/serverAuth';
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
  let context;
  try { context = await getServerUserContext(); requirePermission(context,'reports.view'); }
  catch (e) { return NextResponse.json({error:'Rapor erişim yetkiniz yok'},{status:e instanceof AuthenticationError?401:e instanceof AuthorizationError?403:500}); }

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
