/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server';
import { POST } from '@/app/api/v1/orders/[id]/transition/route';
import { transitionOrder } from '@/lib/features/orders/transitions.service';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { reportServerError } from '@/lib/observability/report-server-error';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/security/field-access.server', () => ({ redactedJson: (...args: Parameters<typeof NextResponse.json>) => NextResponse.json(...args) }));
jest.mock('@/lib/observability/report-server-error', () => ({ reportServerError: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/features/work-orders/security', () => ({
  requireWorkOrderActor: jest.fn().mockResolvedValue({ tenantId: 'tenant-1', userId: 'user-1' }),
  WorkOrderApiError: class extends Error { constructor(message: string, public status: number) { super(message); } },
}));
jest.mock('@/lib/features/manufacturing/http-security', () => ({ requireSameOriginJson: jest.fn() }));
jest.mock('@/lib/features/orders/transitions.service', () => ({ transitionOrder: jest.fn() }));
jest.mock('@/lib/features/records/rules', () => ({ runRecordRules: jest.fn() }));
jest.mock('@/lib/features/stock/depth.server', () => ({ notifyShortageOnApproval: jest.fn() }));

afterEach(() => { jest.restoreAllMocks(); });

async function call(error: Error) {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  (transitionOrder as jest.Mock).mockRejectedValue(error);
  return POST(new NextRequest('http://localhost/api/v1/orders/order-1/transition', { method: 'POST', body: '{}' }), { params: Promise.resolve({ id: 'order-1' }) });
}

it('reports the caught 500 and preserves the response', async () => {
  const error = new Error('private database detail');
  const response = await call(error);
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: 'Durum güncellenemedi. Yeniden deneyin.' });
  expect(reportServerError).toHaveBeenCalledTimes(1);
  expect(reportServerError).toHaveBeenCalledWith('app/api/v1/orders/[id]/transition/route:POST', error);
});

it('keeps domain refusals out of reporting', async () => {
  const response = await call(new WorkOrderApiError('Forbidden', 403));
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: 'Forbidden' });
  expect(reportServerError).not.toHaveBeenCalled();
});
