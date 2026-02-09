import { Order } from '@/lib/types';
import {
  assessOrderRisk,
  getOrderHealthSummary,
  getTopRiskOrders,
} from '@/lib/features/orders/orderHealth';

function createOrder(overrides: Partial<Order>): Order {
  return {
    id: 'ord-test-1' as Order['id'],
    orderNumber: 'ORD-TEST-1',
    customerName: 'Test Müşteri',
    date: '2026-02-01',
    totalAmount: 10000,
    currency: 'TRY',
    status: 'pending',
    productName: 'Test Ürün',
    quantity: 10,
    documents: [],
    createdAt: '2026-02-01T08:00:00.000Z',
    updatedAt: '2026-02-01T08:00:00.000Z',
    ...overrides,
  };
}

describe('orderHealth', () => {
  it('returns low risk for delivered orders', () => {
    const order = createOrder({
      id: 'ord-delivered' as Order['id'],
      status: 'delivered',
      deliveryDate: '2026-02-05',
    });
    const risk = assessOrderRisk(order, new Date('2026-02-08T12:00:00.000Z'));

    expect(risk.level).toBe('low');
    expect(risk.score).toBe(0);
    expect(risk.isOverdue).toBe(false);
  });

  it('marks overdue pending orders as high or critical', () => {
    const order = createOrder({
      id: 'ord-overdue' as Order['id'],
      status: 'pending',
      deliveryDate: '2026-02-03',
      createdAt: '2026-01-28T08:00:00.000Z',
      updatedAt: '2026-02-01T08:00:00.000Z',
    });

    const risk = assessOrderRisk(order, new Date('2026-02-08T12:00:00.000Z'));
    expect(risk.isOverdue).toBe(true);
    expect(['high', 'critical']).toContain(risk.level);
    expect(risk.overdueDays).toBeGreaterThan(0);
  });

  it('creates summary with at-risk and overdue counters', () => {
    const orders: Order[] = [
      createOrder({
        id: 'ord-1' as Order['id'],
        deliveryDate: '2026-02-12',
      }),
      createOrder({
        id: 'ord-2' as Order['id'],
        status: 'in_production',
        deliveryDate: '2026-02-09',
        updatedAt: '2026-01-28T08:00:00.000Z',
      }),
      createOrder({
        id: 'ord-3' as Order['id'],
        status: 'pending',
        deliveryDate: '2026-02-02',
      }),
      createOrder({
        id: 'ord-4' as Order['id'],
        status: 'delivered',
      }),
    ];

    const summary = getOrderHealthSummary(orders, new Date('2026-02-08T12:00:00.000Z'));
    expect(summary.totalOrders).toBe(4);
    expect(summary.activeOrders).toBe(3);
    expect(summary.overdueCount).toBeGreaterThanOrEqual(1);
    expect(summary.atRiskCount).toBeGreaterThanOrEqual(1);
  });

  it('sorts top risk orders by risk score descending', () => {
    const orders: Order[] = [
      createOrder({
        id: 'ord-low' as Order['id'],
        deliveryDate: '2026-02-14',
      }),
      createOrder({
        id: 'ord-high' as Order['id'],
        deliveryDate: '2026-02-03',
      }),
      createOrder({
        id: 'ord-medium' as Order['id'],
        status: 'in_production',
        deliveryDate: '2026-02-09',
        updatedAt: '2026-02-01T08:00:00.000Z',
      }),
    ];

    const result = getTopRiskOrders(orders, 3, new Date('2026-02-08T12:00:00.000Z'));
    expect(result).toHaveLength(3);
    expect(result[0].risk.score).toBeGreaterThanOrEqual(result[1].risk.score);
    expect(result[1].risk.score).toBeGreaterThanOrEqual(result[2].risk.score);
  });
});
