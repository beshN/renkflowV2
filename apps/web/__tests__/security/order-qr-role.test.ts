/** @jest-environment node */
import { NextRequest } from 'next/server';

jest.mock('server-only', () => ({}));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/db', () => ({ sql: jest.fn(async () => []), getSql: () => jest.fn(async () => []) }));
jest.mock('@/lib/security/member-access.server', () => ({
  resolveMemberAccess: jest.fn(),
  sessionRevoked: jest.fn(async () => false),
  mfaSetupPending: jest.fn(async () => false),
}));
jest.mock('@/lib/security/field-access.server', () => ({
  redactedJson: (data: unknown, init?: ResponseInit) => Response.json(data, init),
}));

import { GET as qr } from '@/app/api/orders/qr/route';
import { auth } from '@/auth';
import { resolveMemberAccess } from '@/lib/security/member-access.server';

const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userId = '22222222-2222-4222-8222-222222222222';
const request = () =>
  new NextRequest(`https://renkflow.example/api/orders/qr?token=${'a'.repeat(40)}`);

const access = (overrides: Record<string, unknown>) => ({
  userId,
  tenantId,
  deactivated: false,
  hidden: [],
  base: 'office',
  roleKey: 'office',
  permissions: { orders: ['view', 'create', 'edit', 'export'] },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(auth).mockResolvedValue({ user: { id: userId, tenantId } } as never);
});

describe('orders/qr honours a narrowing role, not just the session base role', () => {
  it('refuses a narrowed role that no longer holds orders (qr.manage maps to orders.edit)', async () => {
    jest.mocked(resolveMemberAccess).mockResolvedValueOnce(access({ roleKey: 'warehouse', permissions: { orders: ['view'] } }) as never);
    const response = await qr(request());
    expect(response.status).toBe(403);
  });

  it('still allows the base role kept on its own preset', async () => {
    jest.mocked(resolveMemberAccess).mockResolvedValueOnce(access({}) as never);
    // Passed authorisation; no matching token row -> 404 (proves the guard did not block it).
    expect((await qr(request())).status).toBe(404);
  });

  it('refuses an unauthenticated caller', async () => {
    jest.mocked(auth).mockResolvedValueOnce(null as never);
    expect((await qr(request())).status).toBe(401);
  });
});
