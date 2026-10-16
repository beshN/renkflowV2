/** @jest-environment node */
/**
 * Cross-tenant order existence disclosure.
 *
 * orderService.getOrderById() throws TenantMismatchError when the order exists but belongs to
 * another tenant, and returns null when it does not exist at all. The route mapped the first to
 * 403 and the second to 404, so any authenticated member of a firm could tell whether a given
 * order id exists in another firm: 403 = it exists somewhere, 404 = it does not.
 *
 * The API must answer the same 404 for both, so the status code carries no cross-tenant signal.
 */
import { NextRequest } from 'next/server';
import { GET, PATCH, DELETE } from '@/app/api/v1/orders/[id]/route';
import { PATCH as PATCH_STATUS } from '@/app/api/v1/orders/[id]/status/route';
import { getAPIUser } from '@/lib/api/auth-helpers';
import { orderService } from '@/lib/services/orderService.server';
import { hasPermission } from '@/lib/auth/rbac';
import { TenantMismatchError } from '@/lib/services/types';

jest.mock('server-only', () => ({}));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/api/auth-helpers', () => ({
  getAPIUser: jest.fn(),
  errorResponse: (error: string, status: number) =>
    Response.json({ success: false, error }, { status }),
  handleCORS: jest.fn(),
}));
jest.mock('@/lib/services/orderService.server', () => ({
  orderService: {
    getOrderById: jest.fn(),
    updateOrder: jest.fn(),
    updateOrderStatus: jest.fn(),
    deleteOrder: jest.fn(),
  },
}));
jest.mock('@/lib/features/orders/access', () => ({ visibleOrdersForActor: jest.fn() }));
jest.mock('@/lib/auth/rbac', () => ({
  hasPermission: jest.fn(),
  AuthorizationError: class AuthorizationError extends Error {},
}));
jest.mock('@/lib/audit/audit-log', () => ({
  changedFields: jest.fn(() => ({})),
  recordAuditAfterCommit: jest.fn(),
}));
jest.mock('@/lib/security/field-access.server', () => ({
  redactedSuccess: (data: unknown, message?: string) =>
    Response.json({ success: true, data, message }),
}));

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const actor = { id: 'user', tenantId: 'tenant-a', role: 'owner', email: 'o@x.invalid', name: 'Owner' } as const;
const params = { params: Promise.resolve({ id: ORDER_ID }) };

const request = (method: string, body?: unknown) =>
  new NextRequest('https://renkflow.example/api/v1/orders/' + ORDER_ID, {
    method,
    headers: { host: 'renkflow.example', ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

beforeEach(() => {
  (getAPIUser as jest.Mock).mockResolvedValue(actor);
  (hasPermission as jest.Mock).mockReturnValue(true);
});

describe('cross-tenant order existence is not disclosed', () => {
  it('answers the same 404 for a cross-tenant order as for a missing order (GET)', async () => {
    (orderService.getOrderById as jest.Mock).mockRejectedValueOnce(new TenantMismatchError());
    const crossTenant = await GET(request('GET'), params);

    (orderService.getOrderById as jest.Mock).mockResolvedValueOnce(null);
    const missing = await GET(request('GET'), params);

    expect(crossTenant.status).toBe(missing.status);
    expect(crossTenant.status).toBe(404);
  });

  it('answers 404 (not 403) when a cross-tenant order is patched', async () => {
    (orderService.getOrderById as jest.Mock).mockRejectedValueOnce(new TenantMismatchError());
    const response = await PATCH(request('PATCH', { notes: 'x' }), params);
    expect(response.status).toBe(404);
    expect(orderService.updateOrder).not.toHaveBeenCalled();
  });

  it('answers 404 (not 403) when a cross-tenant order is deleted', async () => {
    (orderService.getOrderById as jest.Mock).mockRejectedValueOnce(new TenantMismatchError());
    const response = await DELETE(request('DELETE'), params);
    expect(response.status).toBe(404);
    expect(orderService.deleteOrder).not.toHaveBeenCalled();
  });

  it('answers 404 (not 403) when a cross-tenant order status is changed', async () => {
    (orderService.getOrderById as jest.Mock).mockRejectedValueOnce(new TenantMismatchError());
    const response = await PATCH_STATUS(request('PATCH', { status: 'pending' }), params);
    expect(response.status).toBe(404);
    expect(orderService.updateOrderStatus).not.toHaveBeenCalled();
  });
});
