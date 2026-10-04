import type { Order } from '@/lib/types';

export type OrderView = 'all' | 'active' | 'overdue' | 'today' | 'completed';
export type OrderSort = 'newest' | 'oldest' | 'delivery' | 'customer';
const STATUS_ALIASES: Record<string, string> = { pending: 'new', delivered: 'completed', ready: 'ready_for_shipment' };
export const normalizeOrderStatus = (status: string) => STATUS_ALIASES[status] || status;
export const ORDER_STAGE_STATUSES: Record<string, string[]> = {
  intake: ['new', 'pending_approval'], preparation: ['approved', 'preparing_materials', 'ready_for_production'],
  production: ['in_production'], quality: ['quality_check'], shipping: ['ready_for_shipment', 'shipped'], completed: ['completed'],
};
export const isOpenOrder = (order: Pick<Order, 'status'>) => !['completed', 'cancelled'].includes(normalizeOrderStatus(order.status));
export function businessDate(date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function isOverdueOrder(order: Pick<Order, 'status' | 'deliveryDate'>, today = businessDate()) {
  return isOpenOrder(order) && normalizeOrderStatus(order.status) !== 'shipped' && Boolean(order.deliveryDate && order.deliveryDate < today);
}
export function filterWorkspaceOrders(orders: Order[], options: { query?: string; status?: string; stage?: string; view?: OrderView; sort?: OrderSort; today?: string }) {
  const today = options.today || businessDate();
  const keyword = options.query?.trim().toLocaleLowerCase('tr-TR');
  return orders.filter(order => {
    if (keyword && ![order.orderNumber, order.customerName, order.productName, order.notes].some(value => value?.toLocaleLowerCase('tr-TR').includes(keyword))) return false;
    if (options.status && normalizeOrderStatus(order.status) !== normalizeOrderStatus(options.status)) return false;
    if (options.stage && ORDER_STAGE_STATUSES[options.stage] && !ORDER_STAGE_STATUSES[options.stage].includes(normalizeOrderStatus(order.status))) return false;
    if (options.view === 'active' && !isOpenOrder(order)) return false;
    if (options.view === 'overdue' && !isOverdueOrder(order, today)) return false;
    if (options.view === 'today' && (!isOpenOrder(order) || order.deliveryDate !== today)) return false;
    if (options.view === 'completed' && normalizeOrderStatus(order.status) !== 'completed') return false;
    return true;
  }).sort((a, b) => {
    if (options.sort === 'customer') return a.customerName.localeCompare(b.customerName, 'tr');
    if (options.sort === 'delivery') return (a.deliveryDate || '9999').localeCompare(b.deliveryDate || '9999') || b.createdAt.localeCompare(a.createdAt);
    const comparison = (b.createdAt || b.date).localeCompare(a.createdAt || a.date);
    return options.sort === 'oldest' ? -comparison : comparison;
  });
}

function csvCell(value: unknown) {
  let text = String(value ?? '');
  // Spreadsheet software must treat user-entered values as text, never formulas.
  if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function ordersCsv(orders: Order[], includeFinancial = true) {
  const rows: unknown[][] = [['Sipariş no', 'Müşteri', 'Ürün', 'Adet', 'Sipariş tarihi', 'Termin', 'Durum', 'Tutar', 'Para birimi']];
  orders.forEach(order => rows.push([order.orderNumber, order.customerName, order.productName, order.quantity, order.date, order.deliveryDate, normalizeOrderStatus(order.status), order.totalAmount, order.currency]));
  if (!includeFinancial) rows.forEach(row => row.splice(7));
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
}
