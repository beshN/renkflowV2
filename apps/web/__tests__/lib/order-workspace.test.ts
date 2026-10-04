import { businessDate, filterWorkspaceOrders, isOverdueOrder, ordersCsv } from '@/lib/features/orders/workspace';
import { createOrder } from '../helpers/factories';
import type { Order } from '@/lib/types';

const today = '2026-10-03';
// The API also returns the manufacturing workflow's extended statuses.
const order = (status: string, deliveryDate = today) => createOrder({ status: status as Order['status'], deliveryDate });

describe('Order workspace', () => {
  it('uses the Istanbul business day at midnight rather than the UTC day', () => {
    expect(businessDate(new Date('2026-10-02T22:15:00Z'))).toBe(today);
    expect(businessDate(new Date('2026-10-02T20:59:00Z'))).toBe('2026-10-02');
  });

  it('filters legacy and current workflow statuses consistently', () => {
    const orders = [order('pending'), order('new'), order('pending_approval'), order('delivered'), order('completed')];
    expect(filterWorkspaceOrders(orders, { status: 'new' })).toEqual(orders.slice(0, 2));
    expect(filterWorkspaceOrders(orders, { stage: 'intake' })).toEqual(orders.slice(0, 3));
    expect(filterWorkspaceOrders(orders, { view: 'completed' })).toEqual(orders.slice(3));
  });

  it('excludes completed, cancelled and shipped orders from overdue delivery work', () => {
    const orders = ['pending', 'in_production', 'delivered', 'completed', 'cancelled', 'shipped'].map(status => order(status, '2026-10-02'));
    expect(filterWorkspaceOrders(orders, { view: 'overdue', today })).toEqual(orders.slice(0, 2));
    expect(isOverdueOrder(order('pending'), today)).toBe(false);
    expect(isOverdueOrder(createOrder({ deliveryDate: undefined }), today)).toBe(false);
  });

  it('combines Turkish search with delivery sorting and puts undated orders last without mutating data', () => {
    const orders = [createOrder({ customerName: 'IŞIK', deliveryDate: undefined }), createOrder({ customerName: 'Işık', deliveryDate: today }), createOrder({ customerName: 'Başka', deliveryDate: '2026-10-02' })];
    expect(filterWorkspaceOrders(orders, { query: 'ışık', sort: 'delivery' })).toEqual([orders[1], orders[0]]);
    expect(orders[0].deliveryDate).toBeUndefined();
  });

  it('includes only open orders in today’s work', () => {
    const orders = [order('pending'), order('delivered'), order('cancelled'), order('in_production', '2026-10-04')];
    expect(filterWorkspaceOrders(orders, { view: 'today', today })).toEqual([orders[0]]);
  });

  it('exports quoted UTF-8 CSV and neutralizes spreadsheet formulas', () => {
    const csv = ordersCsv([createOrder({ customerName: '=HYPERLINK("x")', productName: 'Profil; "40×40"', notes: 'not exported', currency: 'EUR' })]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"\'=HYPERLINK(""x"")"');
    expect(csv).toContain('"Profil; ""40×40"""');
    expect(csv).toContain('"1000";"EUR"');
    expect(csv).not.toContain('not exported');
  });
});
