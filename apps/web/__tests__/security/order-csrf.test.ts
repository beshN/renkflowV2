/** @jest-environment node */
import { NextRequest } from 'next/server';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db', () => ({ sql: jest.fn(), getSql: () => jest.fn() }));
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
jest.mock('@/lib/features/orders/access', () => ({ visibleOrdersForActor: jest.fn(async (o: unknown[]) => o) }));
jest.mock('@/lib/services/orderService.server', () => ({
  orderService: { createOrder: jest.fn(), getOrderById: jest.fn(), updateOrder: jest.fn(), deleteOrder: jest.fn(), updateOrderStatus: jest.fn() },
}));
jest.mock('@/lib/auth/rbac', () => ({
  hasPermission: jest.fn(() => true),
  AuthorizationError: class AuthorizationError extends Error {},
}));
jest.mock('@/lib/audit/audit-log', () => ({ changedFields: jest.fn(() => ({})), recordAuditAfterCommit: jest.fn() }));
jest.mock('@/lib/security/field-access.server', () => ({
  redactedSuccess: (data: unknown, message?: string) => Response.json({ success: true, data, message }),
  redactedJson: (data: unknown, init?: ResponseInit) => Response.json(data, init),
}));
jest.mock('@/lib/storage/upload-reference', () => ({
  UploadReferenceSchema: { safeParse: () => ({ success: true, data: undefined }) },
  resolveUploadedFile: jest.fn(),
}));

import { POST as createOrder } from '@/app/api/v1/orders/route';
import { PATCH as updateOrder, DELETE as deleteOrder } from '@/app/api/v1/orders/[id]/route';
import { PATCH as updateStatus } from '@/app/api/v1/orders/[id]/status/route';
import { getAPIUser } from '@/lib/api/auth-helpers';
import { orderService } from '@/lib/services/orderService.server';

const id = '11111111-1111-4111-8111-111111111111';
const params = { params: Promise.resolve({ id }) };
const crossSite = { host: 'renkflow.example', origin: 'https://evil.example', 'sec-fetch-site': 'cross-site', 'content-type': 'application/json' };
const sameOrigin = { host: 'renkflow.example', origin: 'https://renkflow.example', 'content-type': 'application/json' };

const request = (method: string, url: string, headers: Record<string, string>, body: unknown) =>
  new NextRequest(url, { method, headers, body: JSON.stringify(body) });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getAPIUser).mockResolvedValue(null);
});

describe('state-changing order routes reject cross-site requests', () => {
  it('POST /api/v1/orders rejects a cross-site request without touching the service', async () => {
    const response = await createOrder(request('POST', 'https://renkflow.example/api/v1/orders', crossSite, { customerName: 'X', productName: 'P', quantity: 1, totalAmount: 1 }));
    expect(response.status).toBe(403);
    expect(orderService.createOrder).not.toHaveBeenCalled();
  });

  it('PATCH /api/v1/orders/:id rejects a cross-site request', async () => {
    expect((await updateOrder(request('PATCH', `https://renkflow.example/api/v1/orders/${id}`, crossSite, { notes: 'x' }), params)).status).toBe(403);
    expect(orderService.updateOrder).not.toHaveBeenCalled();
  });

  it('PATCH /api/v1/orders/:id/status rejects a cross-site request', async () => {
    expect((await updateStatus(request('PATCH', `https://renkflow.example/api/v1/orders/${id}/status`, crossSite, { status: 'approved' }), params)).status).toBe(403);
    expect(orderService.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('DELETE /api/v1/orders/:id rejects a cross-site request', async () => {
    expect((await deleteOrder(request('DELETE', `https://renkflow.example/api/v1/orders/${id}`, crossSite, {}), params)).status).toBe(403);
    expect(orderService.deleteOrder).not.toHaveBeenCalled();
  });

  it('lets a same-origin request through the origin gate (reaches auth)', async () => {
    const response = await createOrder(request('POST', 'https://renkflow.example/api/v1/orders', sameOrigin, { customerName: 'X', productName: 'P', quantity: 1, totalAmount: 1 }));
    expect(response.status).toBe(401);
    expect(getAPIUser).toHaveBeenCalled();
  });
});
