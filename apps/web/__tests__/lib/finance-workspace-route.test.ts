/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/security/field-access.server', () => ({ redactedJson: (data: unknown, init?: ResponseInit) => Response.json(data, init) }));
jest.mock('@/lib/features/work-orders/security', () => ({ requireWorkOrderActor: jest.fn(), WorkOrderApiError: class extends Error { constructor(message: string, readonly status: number) { super(message); } } }));
jest.mock('@/lib/features/finance/workspace.service', () => ({ financeWorkspace: jest.fn() }));
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/finance/workspace/route';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { financeWorkspace } from '@/lib/features/finance/workspace.service';
beforeEach(() => { jest.clearAllMocks(); jest.mocked(requireWorkOrderActor).mockResolvedValue({ userId: 'u', tenantId: 't', role: 'owner' }); jest.mocked(financeWorkspace).mockResolvedValue({ employees: [] } as never); });
it('reports malformed employee filters as 400 and does not query finance data', async () => {
  const response = await GET(new NextRequest('https://renkflow.example/api/v1/finance/workspace?employeeId=not-an-id'));
  expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: 'Geçerli bir çalışan seçin.' }); expect(financeWorkspace).not.toHaveBeenCalled();
});
it('authenticates before validating employee filters', async () => {
  jest.mocked(requireWorkOrderActor).mockRejectedValue(new WorkOrderApiError('Oturum gerekli.', 401));
  expect((await GET(new NextRequest('https://renkflow.example/api/v1/finance/workspace?employeeId=bad'))).status).toBe(401);
});
it('keeps successful finance responses private and forwards only a validated id', async () => {
  const id = '057fa1f4-41be-4238-882a-7dd0909610fa';
  const response = await GET(new NextRequest(`https://renkflow.example/api/v1/finance/workspace?employeeId=${id}`));
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store'); expect(financeWorkspace).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 't' }), id);
});
