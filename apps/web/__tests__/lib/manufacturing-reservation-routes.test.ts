/**
 * @jest-environment node
 *
 * HTTP boundary of the reservation endpoints (POST .../work-orders/[id]/reserve and .../release).
 *
 * Proven invariants:
 *  - only roles holding the 'transition' permission reach the reservation service
 *    (accountant is refused before any service call; owner, admin, office and worker pass),
 *  - the idempotency key is validated by the schema before the service runs,
 *  - service failures map to 400, WorkOrderApiError keeps its own status,
 *  - the work order id from the URL is the one handed to the service.
 */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/security/member-access.server', () => ({ resolveMemberAccess: jest.fn() }));
jest.mock('@/lib/features/manufacturing/reservation.service', () => ({
  reserveWorkOrderMaterials: jest.fn(),
  releaseWorkOrderReservation: jest.fn(),
}));
// Real permission map and error type; only the session lookup is faked.
jest.mock('@/lib/features/work-orders/security', () => {
  const actual = jest.requireActual('@/lib/features/work-orders/security');
  return { ...actual, requireWorkOrderActor: jest.fn() };
});

import { NextRequest } from 'next/server';
import { POST as reservePost } from '@/app/api/v1/manufacturing/work-orders/[id]/reserve/route';
import { POST as releasePost } from '@/app/api/v1/manufacturing/work-orders/[id]/release/route';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import {
  releaseWorkOrderReservation,
  reserveWorkOrderMaterials,
} from '@/lib/features/manufacturing/reservation.service';

const WORK_ORDER = '33333333-3333-4333-8333-333333333333';
const KEY = 'idempotency-key-0001';
const params = { params: Promise.resolve({ id: WORK_ORDER }) };

const reserveRequest = (body: unknown) =>
  new NextRequest('http://x/api/v1/manufacturing/work-orders/' + WORK_ORDER + '/reserve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
const releaseRequest = () =>
  new NextRequest('http://x/api/v1/manufacturing/work-orders/' + WORK_ORDER + '/release', { method: 'POST' });

const signInAs = (role: string) =>
  (requireWorkOrderActor as jest.Mock).mockResolvedValue({ userId: 'user-1', tenantId: 'tenant-1', role });

beforeEach(() => {
  signInAs('owner');
  (reserveWorkOrderMaterials as jest.Mock).mockResolvedValue({ id: 'res-1', status: 'active', lines: [] });
  (releaseWorkOrderReservation as jest.Mock).mockResolvedValue({ released: true, workOrderId: WORK_ORDER });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

it('hands a valid reservation to the service with the id and key from the request', async () => {
  const response = await reservePost(reserveRequest({ idempotencyKey: KEY }), params);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true, data: { id: 'res-1', status: 'active', lines: [] } });
  expect(reserveWorkOrderMaterials).toHaveBeenCalledWith(
    { userId: 'user-1', tenantId: 'tenant-1', role: 'owner' },
    WORK_ORDER,
    KEY,
  );
});

it.each(['owner', 'admin', 'office', 'worker'])('lets a %s with the transition permission reserve', async (role) => {
  signInAs(role);
  const response = await reservePost(reserveRequest({ idempotencyKey: KEY }), params);
  expect(response.status).toBe(200);
  expect(reserveWorkOrderMaterials).toHaveBeenCalledTimes(1);
});

it.each(['accountant', 'member'])('refuses a %s before the reservation service is reached', async (role) => {
  signInAs(role);
  const response = await reservePost(reserveRequest({ idempotencyKey: KEY }), params);
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: 'Bu işlem için yetkiniz yok' });
  expect(reserveWorkOrderMaterials).not.toHaveBeenCalled();
});

it.each([
  ['missing key', {}],
  ['too short a key', { idempotencyKey: 'short' }],
  ['non-string key', { idempotencyKey: 12345678 }],
  ['malformed json', null],
])('rejects %s with 400 and never calls the service', async (_label, body) => {
  const request =
    body === null
      ? new NextRequest('http://x/api/v1/manufacturing/work-orders/' + WORK_ORDER + '/reserve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{not json',
        })
      : reserveRequest(body);
  const response = await reservePost(request, params);
  expect(response.status).toBe(400);
  expect(reserveWorkOrderMaterials).not.toHaveBeenCalled();
});

it('maps a business failure (insufficient stock) to 400 with its message', async () => {
  (reserveWorkOrderMaterials as jest.Mock).mockRejectedValue(
    new Error('Yetersiz kullanılabilir stok: item için 6, mevcut 4'),
  );
  const response = await reservePost(reserveRequest({ idempotencyKey: KEY }), params);
  expect(response.status).toBe(400);
  expect((await response.json()).error).toContain('Yetersiz kullanılabilir stok');
});

it('keeps the status a WorkOrderApiError carries (404 for a foreign work order)', async () => {
  (reserveWorkOrderMaterials as jest.Mock).mockRejectedValue(new WorkOrderApiError('Üretim emri bulunamadı', 404));
  const response = await reservePost(reserveRequest({ idempotencyKey: KEY }), params);
  expect(response.status).toBe(404);
  expect((await response.json()).error).toBe('Üretim emri bulunamadı');
});

it('releases without a body, behind the same transition permission', async () => {
  const ok = await releasePost(releaseRequest(), params);
  expect(ok.status).toBe(200);
  expect(await ok.json()).toEqual({ success: true, data: { released: true, workOrderId: WORK_ORDER } });
  expect(releaseWorkOrderReservation).toHaveBeenCalledWith(
    { userId: 'user-1', tenantId: 'tenant-1', role: 'owner' },
    WORK_ORDER,
  );

  signInAs('accountant');
  const refused = await releasePost(releaseRequest(), params);
  expect(refused.status).toBe(403);
  expect(releaseWorkOrderReservation).toHaveBeenCalledTimes(1);
});

it('maps a release failure to 400', async () => {
  (releaseWorkOrderReservation as jest.Mock).mockRejectedValue(new Error('Üretim emri bulunamadı'));
  const response = await releasePost(releaseRequest(), params);
  expect(response.status).toBe(400);
  expect((await response.json()).error).toBe('Üretim emri bulunamadı');
});
