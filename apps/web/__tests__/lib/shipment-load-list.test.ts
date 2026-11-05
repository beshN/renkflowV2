/** @jest-environment node */
import { readShipmentLoadList } from '@/lib/features/shipments/load-list';
import { shipmentQuantity } from '@/lib/features/shipments/format';
jest.mock('server-only', () => ({}));
jest.mock('@/lib/features/work-orders/security', () => ({ WorkOrderApiError: class extends Error { constructor(message: string, public status: number) { super(message); } } }));
const actor = { tenantId: 'tenant-a', userId: 'user-a', role: 'owner' as const };
it('keeps each quantity in its own unit, including unknown units', () => {
  expect(['m', 'kg', 'adet', null].map(unit => shipmentQuantity('2.50', unit))).toEqual([
    '2.50 m', '2.50 kg', '2.50 adet', '2.50 (birim belirtilmemiş)',
  ]);
});
it('denies workers before querying customer data', async () => {
  const sql = jest.fn();
  await expect(readShipmentLoadList(sql, { ...actor, role: 'worker' }, 'id')).rejects.toMatchObject({ status: 403 });
  expect(sql).not.toHaveBeenCalled();
});
it('returns 404 for another tenant and does not query its lines', async () => {
  const sql = jest.fn().mockResolvedValue([]);
  await expect(readShipmentLoadList(sql, actor, 'other-tenant-shipment')).rejects.toMatchObject({ status: 404 });
  expect(sql).toHaveBeenCalledTimes(1);
  expect(sql.mock.calls[0].slice(1)).toEqual(['tenant-a', 'other-tenant-shipment']);
});
