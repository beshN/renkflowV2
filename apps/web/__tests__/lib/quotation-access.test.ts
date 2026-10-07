/** @jest-environment node */
import { NextRequest } from 'next/server';
import { hasPermission } from '@/lib/features/auth/rbac';
import { ROUTE_ROLES, type UserRole } from '@/lib/features/auth/permissions';
import { getAPIUser } from '@/lib/api/auth-helpers';
import { GET as listQuotations } from '@/app/api/v1/quotations/route';
import { GET as getQuotation } from '@/app/api/v1/quotations/[id]/route';

jest.mock('server-only', () => ({}));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/db', () => ({ sql: jest.fn(async () => []) }));
jest.mock('@/lib/api/auth-helpers', () => ({
  ...jest.requireActual('@/lib/api/auth-helpers'),
  getAPIUser: jest.fn(),
}));
jest.mock('@/lib/features/quotations/service', () => ({
  quotationService: { getQuotations: jest.fn(async () => [{ id: 'q', totalAmount: 1 }]), getQuotationById: jest.fn(async () => ({ id: 'q', totalAmount: 1 })) },
}));

const ROLES: UserRole[] = ['owner', 'admin', 'accountant', 'office', 'worker', 'member'];

it('gives quotation data to exactly the roles that can open the quotations screen', () => {
  for (const role of ROLES) {
    const screen = ROUTE_ROLES['/quotations'].includes(role);
    expect([role, hasPermission(role, 'quotations', 'read'), hasPermission(role, 'quotations', 'list')]).toEqual([role, screen, screen]);
  }
});

it('refuses the quotation list and detail to member and worker', async () => {
  for (const role of ['member', 'worker']) {
    (getAPIUser as jest.Mock).mockResolvedValue({ id: 'u', tenantId: 't', role });
    expect((await listQuotations(new NextRequest('http://x/api/v1/quotations'))).status).toBe(403);
    expect((await getQuotation(new NextRequest('http://x/api/v1/quotations/q'), { params: Promise.resolve({ id: 'q' }) })).status).toBe(403);
  }
  (getAPIUser as jest.Mock).mockResolvedValue({ id: 'u', tenantId: 't', role: 'office' });
  expect((await listQuotations(new NextRequest('http://x/api/v1/quotations'))).status).toBe(200);
});
