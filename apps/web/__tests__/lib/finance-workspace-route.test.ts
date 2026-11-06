/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/security/field-access.server', () => ({ redactedJson: (body: unknown, init?: ResponseInit) => Response.json(body, init) }));
jest.mock('@/lib/features/work-orders/security', () => ({
  requireWorkOrderActor: jest.fn(async () => ({ tenantId: 't', userId: 'u', role: 'owner' })),
  WorkOrderApiError: class extends Error {
    constructor(message: string, public status: number) { super(message); }
  },
}));
jest.mock('@/lib/features/finance/workspace.service', () => ({ financeWorkspace: jest.fn() }));
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/finance/workspace/route';
import { financeWorkspace } from '@/lib/features/finance/workspace.service';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
const workspace = jest.mocked(financeWorkspace);
const request = (query = '') => new NextRequest(`http://localhost/api/v1/finance/workspace${query}`);

beforeEach(() => workspace.mockReset());
test.each(['not-a-uuid', '', '123', 'null'])( 'invalid employeeId %j returns 400 before querying finance', async (id) => {
  const response = await GET(request(`?employeeId=${id}`));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'Geçerli bir çalışan kimliği girin.' });
  expect(workspace).not.toHaveBeenCalled();
});
test.each([undefined, 'c72c27fa-1903-4332-8ba0-507cc8441f18'])('valid filter %s preserves success', async (id) => {
  workspace.mockResolvedValueOnce({ employees: [] } as never);
  const response = await GET(request(id ? `?employeeId=${id}` : ''));
  expect(response.status).toBe(200);
  expect(workspace).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 't' }), id);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
});
test('missing employee preserves tenant-scoped 404', async () => {
  workspace.mockRejectedValueOnce(new WorkOrderApiError('Çalışan kaydı bulunamadı', 404));
  expect((await GET(request('?employeeId=c72c27fa-1903-4332-8ba0-507cc8441f18'))).status).toBe(404);
});
test('database failures stay 503 and do not leak details', async () => {
  workspace.mockRejectedValueOnce(new Error('private database details'));
  const response = await GET(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'Finans kayıtları alınamadı' });
});
test('authentication is still required for invalid input', async () => {
  jest.mocked(requireWorkOrderActor).mockRejectedValueOnce(new WorkOrderApiError('Giriş yapın', 401));
  expect((await GET(request('?employeeId=invalid'))).status).toBe(401);
  expect(workspace).not.toHaveBeenCalled();
});
