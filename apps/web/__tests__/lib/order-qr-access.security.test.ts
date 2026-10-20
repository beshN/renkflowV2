/** @jest-environment node */
/**
 * QR order access: a worker may only open the order they are assigned to.
 *
 * executeOrderQrAction already refuses a worker acting on a work order they are not assigned to,
 * but resolveOrderQrToken (which reads the order and returns the customer name to the screen) did
 * not. A worker who holds a printed QR token could therefore read the customer identity of an order
 * that is not theirs, breaking the app's "no customer identity for workers" boundary.
 */
import { resolveOrderQrToken } from '@/app/actions/order.qr.actions';
import { getServerUserContext } from '@/lib/auth/serverAuth';

const ORDER_ID = '22222222-2222-4222-8222-222222222222';
const TOKEN = 't'.repeat(40);

let mockAssignment: unknown[] = [];
const mockTokenRow = {
  token_id: '33333333-3333-4333-8333-333333333333',
  tenant_id: 'tenant',
  order_id: ORDER_ID,
  label: null,
  allowed_actions: ['note.add'],
  expires_at: null,
  active: true,
  order_number: 'ORD-1',
  customer_name: 'Müşteri',
  product_name: 'Ürün',
  status: 'pending',
  delivery_date: null,
};

jest.mock('server-only', () => ({}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/db', () => {
  const run = (strings: TemplateStringsArray | string, ...values: unknown[]) => {
    if (!Array.isArray(strings)) return { identifier: strings, values };
    const text = (strings as unknown as string[]).join('?');
    if (/FROM order_qr_tokens/.test(text)) return Promise.resolve([mockTokenRow]);
    if (/FROM work_orders/.test(text)) return Promise.resolve(mockAssignment);
    return Promise.resolve([]);
  };
  return { sql: jest.fn(run), getSql: () => jest.fn(run) };
});
jest.mock('@/lib/security/field-redaction.server', () => ({
  redactedAction: (_name: string, fn: () => unknown) => fn(),
}));
jest.mock('@/lib/auth/serverAuth', () => ({
  getServerUserContext: jest.fn(),
  requirePermission: jest.fn(),
  AuthenticationError: class AuthenticationError extends Error {},
  AuthorizationError: class AuthorizationError extends Error {},
}));
jest.mock('@/lib/storage', () => ({ uploadFile: jest.fn(), generateFilePath: jest.fn(() => 'key') }));
jest.mock('@/lib/storage/upload-reference', () => ({
  resolveUploadedFile: jest.fn(),
  verifiedFileKey: jest.fn(),
}));
jest.mock('@/lib/services/auditLog.service', () => ({ AuditLogService: { log: jest.fn() } }));

beforeEach(() => {
  mockAssignment = [];
  (getServerUserContext as jest.Mock).mockResolvedValue({
    userId: 'worker-1',
    tenantId: 'tenant',
    role: 'worker',
    email: 'worker@x.invalid',
    name: 'Worker',
  });
});

it('refuses to resolve an order the worker is not assigned to', async () => {
  mockAssignment = [];
  await expect(resolveOrderQrToken(TOKEN)).rejects.toThrow(/atanmamış|bulunamadı/i);
});

it('resolves the order for a worker who is assigned to it', async () => {
  mockAssignment = [{ id: 'work-order-1' }];
  const resolved = await resolveOrderQrToken(TOKEN);
  expect(resolved.order.id).toBe(ORDER_ID);
});
