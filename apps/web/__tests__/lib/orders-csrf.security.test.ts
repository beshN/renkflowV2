/** @jest-environment node */
/**
 * Same-origin guard on the order write endpoints.
 *
 * Unlike every other mutating API route in the app, POST /api/v1/orders and PATCH
 * /api/v1/orders/:id (and /status) did not call requireSameOrigin. The session cookie is
 * SameSite=Lax, which already blocks the classic cross-site form POST in modern browsers, so this
 * is defence-in-depth rather than an exploitable hole today. The guard keeps every write consistent
 * and stops relying on the browser's cookie policy alone.
 */
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/v1/orders/route';
import { PATCH } from '@/app/api/v1/orders/[id]/route';
import { PATCH as PATCH_STATUS } from '@/app/api/v1/orders/[id]/status/route';
import { getAPIUser } from '@/lib/api/auth-helpers';
import { orderService } from '@/lib/services/orderService.server';
import { hasPermission } from '@/lib/auth/rbac';

jest.mock('server-only', () => ({}));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/api/auth-helpers', () => ({
  getAPIUser: jest.fn(),
  successResponse: (data: unknown, message?: string) =>
    Response.json({ success: true, data, message }),
  errorResponse: (error: string, status: number) =>
    Response.json({ success: false, error }, { status }),
  handleCORS: jest.fn(),
}));
jest.mock('@/lib/services/orderService.server', () => ({
  orderService: {
    createOrder: jest.fn(),
    getOrderById: jest.fn(),
    updateOrder: jest.fn(),
    updateOrderStatus: jest.fn(),
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
  redactedJson: (data: unknown, init?: ResponseInit) => Response.json(data, init),
}));
jest.mock('@/lib/storage/upload-reference', () => ({
  ...jest.requireActual('@/lib/storage/upload-reference'),
  resolveUploadedFile: jest.fn(),
}));

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const HOST = 'renkflow.example';
const actor = { id: 'user', tenantId: 'tenant', role: 'owner', email: 'o@x.invalid', name: 'Owner' } as const;
const params = { params: Promise.resolve({ id: ORDER_ID }) };
const order = {
  id: ORDER_ID,
  orderNumber: 'ORD-1',
  customerName: 'Müşteri',
  productName: 'Ürün',
  quantity: 1,
  totalAmount: 100,
  currency: 'TRY',
  status: 'pending',
  items: [],
  documents: [],
  date: '2024-06-01',
  createdAt: '2024-06-01T00:00:00Z',
  updatedAt: '2024-06-01T00:00:00Z',
};
const validOrder = {
  customerName: 'Müşteri',
  productName: 'Ürün',
  quantity: 1,
  totalAmount: 100,
  currency: 'TRY',
};

const post = (origin: string) =>
  new NextRequest('https://' + HOST + '/api/v1/orders', {
    method: 'POST',
    headers: { host: HOST, origin, 'content-type': 'application/json' },
    body: JSON.stringify(validOrder),
  });
const patch = (origin: string, body: unknown = { notes: 'x' }) =>
  new NextRequest('https://' + HOST + '/api/v1/orders/' + ORDER_ID, {
    method: 'PATCH',
    headers: { host: HOST, origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  (getAPIUser as jest.Mock).mockResolvedValue(actor);
  (hasPermission as jest.Mock).mockReturnValue(true);
  (orderService.createOrder as jest.Mock).mockResolvedValue(order);
  (orderService.getOrderById as jest.Mock).mockResolvedValue(order);
  (orderService.updateOrder as jest.Mock).mockResolvedValue(order);
  (orderService.updateOrderStatus as jest.Mock).mockResolvedValue(order);
});

describe('order writes reject cross-site requests', () => {
  it('rejects a cross-site POST before creating anything', async () => {
    const response = await POST(post('https://evil.example'));
    expect(response.status).toBe(403);
    expect(orderService.createOrder).not.toHaveBeenCalled();
  });

  it('rejects a cross-site PATCH before reading or writing the order', async () => {
    const response = await PATCH(patch('https://evil.example'), params);
    expect(response.status).toBe(403);
    expect(orderService.getOrderById).not.toHaveBeenCalled();
    expect(orderService.updateOrder).not.toHaveBeenCalled();
  });

  it('rejects a cross-site status PATCH', async () => {
    const response = await PATCH_STATUS(patch('https://evil.example', { status: 'pending' }), params);
    expect(response.status).toBe(403);
    expect(orderService.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('still accepts the same-origin POST', async () => {
    const response = await POST(post('https://' + HOST));
    expect(response.status).toBe(200);
    expect(orderService.createOrder).toHaveBeenCalled();
  });

  it('still accepts the same-origin PATCH', async () => {
    const response = await PATCH(patch('https://' + HOST), params);
    expect(response.status).toBe(200);
    expect(orderService.updateOrder).toHaveBeenCalled();
  });
});
