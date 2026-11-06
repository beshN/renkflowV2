/** @jest-environment node */
import { GET } from '@/app/api/v1/shipments/[id]/load-list/route';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { sql } from '@/lib/db';
jest.mock('server-only', () => ({}));
jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
jest.mock('@/lib/security/field-access.server', () => ({ redactedJson: (data: unknown, init?: ResponseInit) => Response.json(data, init) }));
jest.mock('@/lib/features/work-orders/security', () => ({
  requireWorkOrderActor: jest.fn(),
  WorkOrderApiError: class extends Error { constructor(message: string, public status: number) { super(message); } },
}));
const id = '11111111-1111-4111-8111-111111111111';
const call = (value = id) => GET(new Request('http://localhost'), { params: Promise.resolve({ id: value }) });
beforeEach(() => {
  jest.mocked(requireWorkOrderActor).mockResolvedValue({ userId: 'u', tenantId: 'a', role: 'owner' });
  jest.mocked(sql).mockReset();
});
it('requires an authenticated actor', async () => {
  jest.mocked(requireWorkOrderActor).mockRejectedValue(new WorkOrderApiError('Unauthorized', 401));
  expect((await call()).status).toBe(401);
  expect(sql).not.toHaveBeenCalled();
});
it('rejects malformed IDs before querying', async () => {
  expect((await call('invalid')).status).toBe(400);
  expect(sql).not.toHaveBeenCalled();
});
it('returns tenant-bound data without shared cache', async () => {
  jest.mocked(sql).mockResolvedValueOnce([{ id, shipment_number: 'S-TEST' }] as never).mockResolvedValueOnce([] as never);
  const response = await call();
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(await response.json()).toMatchObject({ success: true, data: { id, items: [] } });
});
it('does not expose SQL errors', async () => {
  jest.mocked(sql).mockRejectedValue(new Error('private database details') as never);
  const response = await call();
  expect(response.status).toBe(500);
  expect(JSON.stringify(await response.json())).not.toContain('private database details');
});
