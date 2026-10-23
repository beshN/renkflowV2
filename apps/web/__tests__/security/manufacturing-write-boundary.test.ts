/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
jest.mock('@/lib/features/work-orders/security', () => {
  const actual = jest.requireActual('@/lib/features/work-orders/security');
  return { ...actual, requireWorkOrderActor: jest.fn() };
});
jest.mock('@/lib/features/manufacturing/manufacturing.service', () => ({ createProductionWorkOrder: jest.fn(), transferWorkOrderMaterials: jest.fn(), completeProductionRun: jest.fn() }));
jest.mock('@/lib/features/manufacturing/reservation.service', () => ({ reserveWorkOrderMaterials: jest.fn(), releaseWorkOrderReservation: jest.fn() }));
import { NextRequest } from 'next/server';
import { POST as create } from '@/app/api/v1/manufacturing/work-orders/route';
import { POST as reserve } from '@/app/api/v1/manufacturing/work-orders/[id]/reserve/route';
import { POST as release } from '@/app/api/v1/manufacturing/work-orders/[id]/release/route';
import { POST as transfer } from '@/app/api/v1/manufacturing/work-orders/[id]/transfer/route';
import { POST as complete } from '@/app/api/v1/manufacturing/work-orders/[id]/complete/route';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
const params = { params: Promise.resolve({ id: '057fa1f4-41be-4238-882a-7dd0909610fa' }) };
beforeEach(() => jest.clearAllMocks());
it.each([['create', create], ['reserve', reserve], ['release', release], ['transfer', transfer], ['complete', complete]] as const)('refuses cross-origin %s before reading membership or mutating stock', async (_name, route) => {
  const request = new NextRequest('https://renkflow.example/api/v1/manufacturing/work-orders', { method: 'POST', headers: { origin: 'https://attacker.invalid', 'content-type': 'application/json' }, body: '{}' });
  const response = await route(request, params);
  expect(response.status).toBe(403);
  expect(requireWorkOrderActor).not.toHaveBeenCalled();
});
