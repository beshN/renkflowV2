/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/api/auth-helpers', () => ({ getAPIUser: jest.fn() }));
jest.mock('@/lib/features/work-orders/security', () => {
  class WorkOrderApiError extends Error {
    constructor(message: string, public status: number, public code?: string) { super(message); }
  }
  return { WorkOrderApiError };
});
jest.mock('@/lib/features/manufacturing/lot-trace.server', () => ({ traceLots: jest.fn() }));
jest.mock('@/lib/observability/report-server-error', () => ({ reportServerError: jest.fn() }));
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/traceability/lots/route';
import { getAPIUser } from '@/lib/api/auth-helpers';
import { traceLots } from '@/lib/features/manufacturing/lot-trace.server';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';

const request = () => new NextRequest('http://localhost/api/v1/traceability/lots?heat=H');
beforeEach(() => jest.resetAllMocks());
it('returns 401 without an authenticated user', async () => {
  jest.mocked(getAPIUser).mockResolvedValue(null);
  const response = await GET(request());
  expect(response.status).toBe(401);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(traceLots).not.toHaveBeenCalled();
});
it('preserves MFA setup refusals and their code', async () => {
  jest.mocked(getAPIUser).mockRejectedValue(new WorkOrderApiError('MFA required', 403, 'mfa_setup_required'));
  const response = await GET(request());
  expect(response.status).toBe(403);
  expect((await response.json()).code).toBe('mfa_setup_required');
  expect(traceLots).not.toHaveBeenCalled();
});
it('lets the service conceal worker access with 404', async () => {
  jest.mocked(getAPIUser).mockResolvedValue({ id:'worker',tenantId:'tenant',role:'worker' } as Awaited<ReturnType<typeof getAPIUser>>);
  jest.mocked(traceLots).mockRejectedValue(new WorkOrderApiError('Bulunamadı',404));
  expect((await GET(request())).status).toBe(404);
  expect(traceLots).toHaveBeenCalledWith({ userId:'worker',tenantId:'tenant',role:'worker' }, { heat:'H',supplierLot:null });
});
