/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
jest.mock('@/lib/features/work-orders/security', () => ({
  requireWorkOrderActor: jest.fn(),
  WorkOrderApiError: class extends Error { constructor(message: string, public status: number) { super(message); } },
}));
jest.mock('@/lib/features/field/common.server', () => ({ requireCap: jest.fn() }));
jest.mock('@/lib/security/field-access.server', () => ({ hidesAny: jest.fn().mockResolvedValue(false) }));
// Keep the real labelRecord tenant queries; isolate unrelated production dependencies.
jest.mock('@/lib/features/manufacturing/platform.service', () => ({ cutPlanSheet: jest.fn() }));
jest.mock('@/lib/features/manufacturing/inventory.service', () => ({}));
import { sql } from '@/lib/db';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { requireCap } from '@/lib/features/field/common.server';
import { cutPlanSheet } from '@/lib/features/manufacturing/platform.service';
import { GET } from '@/app/api/v1/labels/zpl/route';
const tenantA = '10000000-0000-4000-8000-000000000001';
const tenantB = '20000000-0000-4000-8000-000000000001';
const foreignId = '30000000-0000-4000-8000-000000000001';
const actor = { tenantId: tenantA, userId: foreignId, role: 'office' };
const request = (kind: string, id = foreignId) => new Request(`http://localhost/api/v1/labels/zpl?kind=${kind}&id=${id}`);
beforeEach(() => { jest.mocked(requireWorkOrderActor).mockResolvedValue(actor as never); jest.mocked(requireCap).mockResolvedValue({} as never); });
it.each(['shipment', 'location', 'job'])('denies another tenant’s %s through the real service and scoped SQL', async (kind) => {
  const seen: string[] = [];
  jest.mocked(sql).mockImplementation((parts: TemplateStringsArray, ...values: unknown[]) => {
    const query = parts.join('?'); seen.push(query);
    expect(query).toMatch(/tenant_id=/);
    expect(values).toContain(tenantA);
    expect(values).not.toContain(tenantB);
    // Fixture exists only in B. An unscoped query would expose it.
    return Promise.resolve(values.includes(tenantB) || !query.includes('tenant_id=') ? [{ id: foreignId, customer_name: 'FOREIGN' }] : []) as never;
  });
  const response = await GET(request(kind));
  expect(response.status).toBe(404);
  expect(await response.text()).not.toContain('FOREIGN');
  expect(seen.length).toBeGreaterThan(0);
});
it('forwards the authenticated tenant to the existing cut-sheet authorization', async () => {
  jest.mocked(cutPlanSheet).mockRejectedValue(new WorkOrderApiError('Kesim planı bulunamadı', 404));
  expect((await GET(request('cut'))).status).toBe(404);
  expect(cutPlanSheet).toHaveBeenCalledWith(actor, foreignId);
});
it('returns an attachment for an own-tenant location, reusing the existing identity', async () => {
  jest.mocked(sql).mockImplementation((parts: TemplateStringsArray, ...values: unknown[]) => {
    expect(values).toContain(tenantA);
    return Promise.resolve(parts.join('').includes('factory_labels') ? [{ code: 'RF-R-012345ABCDEF' }] : [{ id: foreignId, code: 'A1', warehouse_name: 'Test depo', name: 'Test raf' }]) as never;
  });
  const response = await GET(request('location'));
  expect(response.status).toBe(200);
  expect(response.headers.get('content-disposition')).toContain('.zpl');
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(await response.text()).toContain('^BQN');
});
it('refuses missing auth, forbidden role and narrowed permissions', async () => {
  jest.mocked(requireWorkOrderActor).mockRejectedValueOnce(new WorkOrderApiError('Unauthorized', 401));
  expect((await GET(request('location'))).status).toBe(401);
  jest.mocked(requireWorkOrderActor).mockResolvedValueOnce({ ...actor, role: 'worker' } as never);
  expect((await GET(request('location'))).status).toBe(403);
  jest.mocked(requireCap).mockRejectedValueOnce(new WorkOrderApiError('Yasak', 403));
  expect((await GET(request('location'))).status).toBe(403);
});
it('emits one label per cut piece and filters shared plans to the requested job', async () => {
  const otherJob = '40000000-0000-4000-8000-000000000001';
  jest.mocked(sql).mockResolvedValue([{ cut_plan_id: foreignId }] as never);
  jest.mocked(cutPlanSheet).mockResolvedValue({ status: 'approved', notice: null, bars: [{ item: { profileCode: 'P108' }, pieces: [
    { lengthMm: 1200, job: { id: foreignId, orderNumber: 'TEST-1' } },
    { lengthMm: 1300, job: { id: otherJob, orderNumber: 'TEST-2' } },
  ] }] } as never);
  const all = await GET(request('cut'));
  expect(all.status).toBe(200);
  expect((await all.text()).match(/\^XA/g)).toHaveLength(2);
  const own = await GET(request('job'));
  expect(own.status).toBe(200);
  expect((await own.text()).match(/\^XA/g)).toHaveLength(1);
});
it('does not label a draft or cancelled plan', async () => {
  for (const status of ['draft', 'cancelled']) {
    jest.mocked(cutPlanSheet).mockResolvedValue({ status } as never);
    expect((await GET(request('cut'))).status).toBe(409);
  }
});
