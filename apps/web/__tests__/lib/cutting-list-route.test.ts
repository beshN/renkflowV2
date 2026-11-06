/** @jest-environment node */
jest.mock('@/lib/features/work-orders/security', () => {
  class WorkOrderApiError extends Error { constructor(message: string, public status: number) { super(message); } }
  return { WorkOrderApiError, requireWorkOrderActor: jest.fn() };
});
jest.mock('@/lib/features/manufacturing/cutting-list-export.server', () => ({ exportCuttingList: jest.fn() }));
jest.mock('@/lib/security/field-access.server', () => ({ redactedJson: (body: unknown, init: ResponseInit) => Response.json(body, init) }));
import { GET } from '@/app/api/v1/production/cut-plans/[id]/csv/route';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { exportCuttingList } from '@/lib/features/manufacturing/cutting-list-export.server';
const actor = { tenantId: 'session-tenant', userId: 'user', role: 'owner' as const };
const params = Promise.resolve({ id: 'plan' });
beforeEach(() => jest.resetAllMocks());
it('uses the verified actor, ignores client tenant and downloads private UTF-8 CSV', async () => {
  jest.mocked(requireWorkOrderActor).mockResolvedValue(actor);
  jest.mocked(exportCuttingList).mockResolvedValue('\uFEFFProfil adı\r\nÖlçü');
  const response = await GET(new Request('http://localhost/api?tenantId=other'), { params });
  expect(exportCuttingList).toHaveBeenCalledWith(actor, 'plan');
  expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
  expect(response.headers.get('Content-Disposition')).toContain('attachment;');
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(new Uint8Array(await response.arrayBuffer()).slice(0,3)).toEqual(new Uint8Array([239,187,191]));
});
it.each([401,403])('refuses authentication/access failure %s before querying', async status => {
  jest.mocked(requireWorkOrderActor).mockRejectedValue(new WorkOrderApiError('Denied', status));
  expect((await GET(new Request('http://localhost'), { params })).status).toBe(status);
  expect(exportCuttingList).not.toHaveBeenCalled();
});
it('returns 404 for inaccessible plans', async () => {
  jest.mocked(requireWorkOrderActor).mockResolvedValue(actor);
  jest.mocked(exportCuttingList).mockRejectedValue(new WorkOrderApiError('Missing',404));
  expect((await GET(new Request('http://localhost'), { params })).status).toBe(404);
});
