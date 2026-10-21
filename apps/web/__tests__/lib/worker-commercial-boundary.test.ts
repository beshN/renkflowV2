/** @jest-environment node */
import { canAccessRoute, getRoutePermissions, type UserRole } from '@/lib/features/auth/permissions';
import { hasPermission as hasResourcePermission } from '@/lib/features/auth/rbac';
import { evaluateRouteAccess } from '@/lib/features/auth/route-access';
import { getVisibleNavGroups } from '@/lib/core/dashboard-nav';
import { technicalOrder } from '@/lib/features/orders/access';
import { getServerUserContext } from '@/lib/features/auth/serverAuth';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { GET as analyticsCustomers } from '@/app/api/analytics/customers/route';
import { GET as exportJobs } from '@/app/api/export/route';
import { GET as exportDownload } from '@/app/api/export/[id]/download/route';
import { GET as shipments } from '@/app/api/v1/shipments/route';
import { NextRequest } from 'next/server';
import { createOrder } from '../helpers/factories';

jest.mock('server-only', () => ({}));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/db', () => ({ sql: jest.fn(async () => []) }));
jest.mock('@/lib/features/auth/serverAuth', () => ({ ...jest.requireActual('@/lib/features/auth/serverAuth'), getServerUserContext: jest.fn() }));
jest.mock('@/lib/features/work-orders/security', () => ({ ...jest.requireActual('@/lib/features/work-orders/security'), requireWorkOrderActor: jest.fn() }));
jest.mock('@/lib/analytics/reporting', () => ({ getCustomerMetrics: jest.fn(async () => ({ topCustomers: [{ customerName: 'X', totalSpent: 1 }] })) }));
jest.mock('@/lib/export/service', () => ({ listExportJobs: jest.fn(async () => []), getExportJob: jest.fn(), createExportJob: jest.fn() }));
jest.mock('@/lib/security/rate-limit', () => ({ consumeRateLimit: jest.fn(async () => ({ allowed: true })), rateLimitResponse: jest.fn() }));

const ROLES: UserRole[] = ['owner', 'admin', 'accountant', 'office', 'worker', 'member'];

describe('worker screens', () => {
  const denied = ['/quotations', '/quotations/new', '/quotations/q1/print', '/crm', '/crm/c1', '/shipments', '/accounting', '/purchases', '/receipts', '/suppliers', '/scrap', '/production', '/production/intake/i1', '/new-order', '/work-orders/new', '/finance', '/finance/documents', '/reports', '/settings', '/team','/dashboard','/factory','/work-orders','/orders','/kanban','/inventory','/warehouse/scan','/notifications','/search'];
  const allowed = ['/production/worker','/account'];
  it.each(denied)('denies %s', (path) => expect(canAccessRoute('worker', path)).toBe(false));
  it.each(allowed)('keeps %s', (path) => expect(canAccessRoute('worker', path)).toBe(true));

  it('never shows a menu link whose screen the role cannot open', () => {
    for (const role of ROLES) {
      for (const item of getVisibleNavGroups(role).flatMap((group) => group.items).filter((item) => !item.action)) {
        expect([role, item.href, canAccessRoute(role, item.href)]).toEqual([role, item.href, true]);
      }
    }
  });

  it('keeps commercial screens open to the roles that use them', () => {
    for (const path of ['/quotations', '/crm', '/shipments', '/production', '/purchases']) {
      expect(canAccessRoute('owner', path)).toBe(true);
      expect(canAccessRoute('office', path)).toBe(true);
    }
    expect(canAccessRoute('accountant', '/accounting')).toBe(true);
  });
});

describe('server-side route boundary (proxy)', () => {
  it('sends a navigation back to the dashboard and refuses server actions with 403', () => {
    expect(evaluateRouteAccess('worker', '/accounting', 'GET')).toEqual({ type: 'redirect', destination: '/production/worker' });
    expect(evaluateRouteAccess('worker', '/accounting', 'POST')).toEqual({ type: 'forbidden' });
    expect(evaluateRouteAccess('worker', '/finance/documents', 'POST')).toEqual({ type: 'forbidden' });
    expect(evaluateRouteAccess('worker', '/production/worker', 'POST')).toEqual({ type: 'next' });
    expect(evaluateRouteAccess('owner', '/accounting', 'POST')).toEqual({ type: 'next' });
  });
  it('uses the most specific route permission', () => {
    expect(getRoutePermissions('/finance/payments/p1')).toEqual(['finance.payments.view']);
    expect(getRoutePermissions('/inventory/new')).toEqual(['inventory.edit']);
    expect(getRoutePermissions('/inventory/i1')).toEqual(['inventory.view']);
  });
  it('leaves unknown token roles to the API checks', () => {
    expect(evaluateRouteAccess(undefined, '/accounting', 'GET')).toEqual({ type: 'next' });
  });
});

describe('worker API responses', () => {
  it('removes the customer from the technical order', () => {
    const dto = technicalOrder(createOrder({ customerName: 'Örnek Yapı A.Ş.', orderNumber: 'RF-1' }));
    expect(dto.customerName).toBe('');
    expect(JSON.stringify(dto)).not.toContain('Örnek Yapı');
    expect(dto.orderNumber).toBe('RF-1');
  });

  it('gives quotations (prices, customers) to commercial roles only', () => {
    expect(hasResourcePermission('worker', 'quotations', 'read')).toBe(false);
    expect(hasResourcePermission('worker', 'quotations', 'list')).toBe(false);
    expect(hasResourcePermission('owner', 'quotations', 'read')).toBe(true);
  });

  it('refuses customer spend, export jobs and shipments to a worker', async () => {
    (getServerUserContext as jest.Mock).mockResolvedValue({ userId: 'u', tenantId: 't', role: 'worker', email: '', name: '' });
    (requireWorkOrderActor as jest.Mock).mockResolvedValue({ userId: 'u', tenantId: 't', role: 'worker' });
    expect((await analyticsCustomers(new Request('http://x/api/analytics/customers'))).status).toBe(403);
    expect((await exportJobs(new Request('http://x/api/export'))).status).toBe(403);
    expect((await exportDownload(new NextRequest('http://x/api/export/j1/download'), { params: Promise.resolve({ id: 'j1' }) } as never)).status).toBe(403);
    expect((await shipments(new NextRequest('http://x/api/v1/shipments'))).status).toBe(403);
  });
});
