/** @jest-environment node */
import { NextRequest } from 'next/server';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/features/work-orders/security', () => ({
  WorkOrderApiError: class WorkOrderApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = 'WorkOrderApiError';
      this.status = status;
    }
  },
  requireWorkOrderActor: jest.fn(),
}));
jest.mock('@/lib/api/auth-helpers', () => ({
  getAPIUser: jest.fn(),
  errorResponse: (error: string, status = 400) => Response.json({ success: false, error }, { status }),
  successResponse: (data: unknown, message?: string) => Response.json({ success: true, data, message }),
  handleCORS: jest.fn(() => new Response(null, { status: 200 })),
}));
jest.mock('@/lib/features/manufacturing/http-security', () => ({
  requireSameOrigin: jest.fn(),
  requireSameOriginJson: jest.fn(),
}));
jest.mock('@/lib/features/orders/access', () => ({
  visibleOrdersForActor: jest.fn(async (orders: unknown[]) => orders),
}));
jest.mock('@/lib/security/field-access.server', () => ({
  redactedSuccess: (data: unknown, message?: string) => Response.json({ success: true, data, message }),
  redactedJson: (data: unknown, init?: ResponseInit) => Response.json(data, init),
}));
jest.mock('@/lib/services/orderService.server', () => ({
  orderService: {
    getOrderById: jest.fn(),
    updateOrder: jest.fn(),
    deleteOrder: jest.fn(),
    updateOrderStatus: jest.fn(),
  },
}));
jest.mock('@/lib/auth/rbac', () => ({
  hasPermission: jest.fn(() => true),
  AuthorizationError: class AuthorizationError extends Error {},
}));
jest.mock('@/lib/audit/audit-log', () => ({
  changedFields: jest.fn(() => ({})),
  recordAuditAfterCommit: jest.fn(),
}));

import { GET, PATCH, DELETE } from '@/app/api/v1/orders/[id]/route';
import { PATCH as PATCH_STATUS } from '@/app/api/v1/orders/[id]/status/route';
import { getAPIUser } from '@/lib/api/auth-helpers';
import { orderService } from '@/lib/services/orderService.server';
import { TenantMismatchError } from '@/lib/services/types';

const id = '11111111-1111-4111-8111-111111111111';
const tenant = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const actor = { id: '22222222-2222-4222-8222-222222222222', tenantId: tenant, role: 'owner', email: 'owner@example.invalid', name: 'Owner' };
const params = { params: Promise.resolve({ id }) };

const request = (method: string, body?: unknown) =>
  new NextRequest(`https://renkflow.example/api/v1/orders/${id}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getAPIUser).mockResolvedValue(actor);
});

describe('order existence is not disclosed across tenants', () => {
  it('answers a cross-tenant GET with 404, not 403', async () => {
    jest.mocked(orderService.getOrderById).mockRejectedValueOnce(new TenantMismatchError());
    const response = await GET(request('GET'), params);
    expect(response.status).toBe(404);
  });

  it('answers an unknown order GET with 404 as well (no observable difference)', async () => {
    jest.mocked(orderService.getOrderById).mockResolvedValueOnce(null);
    const response = await GET(request('GET'), params);
    expect(response.status).toBe(404);
  });

  it('answers a cross-tenant PATCH with 404 and never updates', async () => {
    jest.mocked(orderService.getOrderById).mockRejectedValueOnce(new TenantMismatchError());
    const response = await PATCH(request('PATCH', { notes: 'x' }), params);
    expect(response.status).toBe(404);
    expect(orderService.updateOrder).not.toHaveBeenCalled();
  });

  it('answers a cross-tenant DELETE with 404 and never deletes', async () => {
    jest.mocked(orderService.getOrderById).mockRejectedValueOnce(new TenantMismatchError());
    const response = await DELETE(request('DELETE'), params);
    expect(response.status).toBe(404);
    expect(orderService.deleteOrder).not.toHaveBeenCalled();
  });

  it('answers a cross-tenant status change with 404 and never transitions', async () => {
    jest.mocked(orderService.getOrderById).mockRejectedValueOnce(new TenantMismatchError());
    const response = await PATCH_STATUS(request('PATCH', { status: 'approved' }), params);
    expect(response.status).toBe(404);
    expect(orderService.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('still serves a same-tenant order', async () => {
    jest.mocked(orderService.getOrderById).mockResolvedValueOnce({ id, tenantId: tenant } as never);
    const response = await GET(request('GET'), params);
    expect(response.status).toBe(200);
  });
});
