/** @jest-environment node */
import { NextRequest } from 'next/server';
import { fieldActor, fieldJob, fieldOperation, assertFieldJob, readFieldJson } from '@/lib/features/field/service';
import { GET, POST } from '@/app/api/v1/field/[...path]/route';
import { getAPIUser, verifyAPIToken } from '@/lib/api/auth-helpers';
import { sql } from '@/lib/db';
import { productionCommand } from '@/lib/features/manufacturing/platform.service';
import { updateWorkOrder } from '@/lib/features/work-orders/service';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';

jest.mock('server-only', () => ({}));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/db', () => ({ sql: jest.fn(async () => []) }));
jest.mock('@/lib/api/auth-helpers', () => ({ getAPIUser: jest.fn(), verifyAPIToken: jest.fn() }));
jest.mock('@/lib/features/manufacturing/platform.service', () => ({ productionCommand: jest.fn(), productionOverview: jest.fn() }));
jest.mock('@/lib/features/manufacturing/files.service', () => ({ storeProductionFile: jest.fn() }));
jest.mock('@/lib/features/work-orders/service', () => ({ ...jest.requireActual('@/lib/features/work-orders/service'), updateWorkOrder: jest.fn() }));

const id = '00000000-0000-4000-8000-000000000001';
const worker = { id, email: 'field@example.com', name: 'Operator', role: 'worker', tenantId: '00000000-0000-4000-8000-000000000002' };
const actor = { userId: worker.id, tenantId: worker.tenantId, role: 'worker' as const };
const context = (path: string[]) => ({ params: Promise.resolve({ path }) });
function request(path: string, body?: unknown, token = true) {
  return new NextRequest(`https://renkflow.com/api/v1/field/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(token ? { authorization: 'Bearer valid' } : {}), 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
beforeEach(() => {
  jest.clearAllMocks(); delete process.env.PRIVATE_ACCESS_EMAIL;
  jest.mocked(getAPIUser).mockResolvedValue(worker);
  jest.mocked(verifyAPIToken).mockResolvedValue(worker);
  jest.mocked(sql).mockResolvedValue([{ id, recipe_id: null }] as never);
});
afterAll(() => { delete process.env.PRIVATE_ACCESS_EMAIL; });

test('rejects missing or invalid bearer even if an ambient web session exists', async () => {
  await expect(fieldActor(request('snapshot', undefined, false))).rejects.toMatchObject({ status: 401 });
  jest.mocked(verifyAPIToken).mockResolvedValue(null);
  await expect(fieldActor(request('snapshot'))).rejects.toMatchObject({ status: 401 });
  expect(getAPIUser).not.toHaveBeenCalled();
});
test('rechecks private pilot and allowed field roles', async () => {
  process.env.PRIVATE_ACCESS_EMAIL = 'another@example.com';
  await expect(fieldActor(request('snapshot'))).rejects.toMatchObject({ status: 401 });
  delete process.env.PRIVATE_ACCESS_EMAIL;
  jest.mocked(getAPIUser).mockResolvedValue({ ...worker, role: 'accountant' });
  await expect(fieldActor(request('snapshot'))).rejects.toMatchObject({ status: 403 });
});
test('rejects revoked membership', async () => {
  jest.mocked(getAPIUser).mockResolvedValue(null);
  expect((await GET(request('snapshot'), context(['snapshot']))).status).toBe(401);
});
test('job guard binds both firm and operator and hides nonexistent jobs', async () => {
  await assertFieldJob(actor, id);
  const args = jest.mocked(sql).mock.calls[0];
  expect(args).toContain(worker.tenantId); expect(args).toContain(worker.id);
  jest.mocked(sql).mockResolvedValue([] as never);
  await expect(assertFieldJob(actor, id)).rejects.toMatchObject({ status: 404 });
});
test('projections never return commercial fields or recipe snapshots', () => {
  const result = fieldJob({ id, title: 'Cut', status: 'open', priority: 'high', totalAmount: 900, customerName: 'PRIVATE', bom_snapshot: { cost: 900 }, configuration: { sensitive: true } });
  expect(result).not.toHaveProperty('totalAmount'); expect(result).not.toHaveProperty('customerName'); expect(result).not.toHaveProperty('bom_snapshot'); expect(result).not.toHaveProperty('configuration');
  const op = fieldOperation({ id, work_order_id: id, name: 'Assembly', position: 0, work_center_code: 'C', status: 'ready', version: 1, planned_qty: '4', completed_qty: '0', cost: 20 });
  expect(op.plannedQty).toBe(4); expect(op).not.toHaveProperty('cost');
});
test('worker cannot close a general work order', async () => {
  const response = await POST(request(`work-orders/${id}/transition`, { status: 'done' }), context(['work-orders', id, 'transition']));
  expect(response.status).toBe(403); expect(updateWorkOrder).not.toHaveBeenCalled();
});
test('production jobs must use the operation state machine', async () => {
  jest.mocked(sql).mockResolvedValue([{ id, recipe_id: id }] as never);
  const response = await POST(request(`work-orders/${id}/transition`, { status: 'in_progress' }), context(['work-orders', id, 'transition']));
  expect(response.status).toBe(409); expect(updateWorkOrder).not.toHaveBeenCalled();
});
test('passes unchanged command identity to idempotent production service', async () => {
  const value = { commandId: id, action: 'operation', data: { operationId: id, version: 3, action: 'start' } };
  jest.mocked(productionCommand).mockResolvedValue({ status: 'running' });
  expect((await POST(request('commands', value), context(['commands']))).status).toBe(200);
  expect(productionCommand).toHaveBeenCalledWith(expect.objectContaining(actor), expect.objectContaining({ commandId: id, data: expect.objectContaining({ version: 3 }) }));
});
test('native command surface cannot invoke financial or warehouse commands', async () => {
  const response = await POST(request('commands', { commandId: id, action: 'finance.payment', data: {} }), context(['commands']));
  expect(response.status).toBe(400); expect(productionCommand).not.toHaveBeenCalled();
});
test('preserves assignment/conflict denials and quality rejection result', async () => {
  const value = { commandId: id, action: 'operation', data: { operationId: id, version: 3, action: 'start' } };
  jest.mocked(productionCommand).mockRejectedValue(new WorkOrderApiError('Bu iş size atanmadı', 403));
  expect((await POST(request('commands', value), context(['commands']))).status).toBe(403);
  jest.mocked(productionCommand).mockResolvedValue({ qualityRejected: true });
  const response = await POST(request('commands', value), context(['commands']));
  expect((await response.json()).data).toEqual({ accepted: true, qualityRejected: true });
});
test('rejects cross-site writes and actual oversized bodies without relying on content-length', async () => {
  const crossSite = new NextRequest('https://renkflow.com/api/v1/field/commands', { method: 'POST', headers: { origin: 'https://other.example', authorization: 'Bearer valid', 'content-type': 'application/json' }, body: '{}' });
  expect((await POST(crossSite, context(['commands']))).status).toBe(403);
  await expect(readFieldJson(request('commands', { text: 'x'.repeat(65_000) }))).rejects.toMatchObject({ status: 413 });
});
