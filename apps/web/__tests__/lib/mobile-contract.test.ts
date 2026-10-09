/** @jest-environment node */
import { NextRequest } from 'next/server';
import { needsUpdate, validateMobileDTO } from '@/lib/features/mobile/contract';
import { mobileAccess, currentMobileAccess } from '@/lib/features/mobile/access';
import { GET } from '@/app/api/mobile/v1/[...path]/route';
import { sql } from '@/lib/db';
jest.mock('server-only', () => ({}));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/db', () => ({ sql: jest.fn(async () => []) }));
const job = { id: '1', title: 'Kesim', description: null, status: 'open', priority: 'high', category: 'production', location: null, dueAt: null, assigneeName: null, checklistTotal: 0, checklistCompleted: 0, blockedReasonDetail: null, color: null };
it.each(['1.0.0', '0.9.9', null, '1.1', 'abc', '1.1.0-beta'])('requires update for %s', v => expect(needsUpdate(v)).toBe(true));
it.each(['1.1.0', '1.1.1', '2.0.0'])('accepts compatible version %s', v => expect(needsUpdate(v)).toBe(false));
it('rejects old apps before authentication or data access', async () => {
  const response = await GET(new NextRequest('https://renkflow.com/api/mobile/v1/snapshot', { headers: { 'x-renkflow-app-version': '1.0.0', 'x-renkflow-platform': 'android' } }), { params: Promise.resolve({ path: ['snapshot'] }) });
  expect(response.status).toBe(426); expect((await response.json()).code).toBe('APP_UPDATE_REQUIRED'); expect(sql).not.toHaveBeenCalled();
});
it.each(['owner','admin','office','worker','accountant','member'])('fails closed on commercial/customer/recipe additions for %s', role => {
  const forbidden = { price: 100, cost: 90, profit: 10, customerPhone: 'PRIVATE', bom_snapshot: { recipe: 'PRIVATE' }, role };
  expect(() => validateMobileDTO('Job', { ...job, ...forbidden })).toThrow();
  expect(validateMobileDTO('Job', job)).toEqual(job);
});
it('validates nested operation and quality contracts rather than accepting arbitrary payloads', () => {
  expect(() => validateMobileDTO('Snapshot', { workOrders: [job], operations: [{ price: 10 }], generatedAt: '2026-10-09', truncated: false, permissions: { transition: true, close: false, checklist: true, comment: true } })).toThrow();
});
it('honors warehouse/read-only and intersects custom roles with base caps', () => {
  expect(mobileAccess('office','warehouse').production).toEqual({ view: true, edit: false });
  expect(mobileAccess('worker','operator').inventory.edit).toBe(false);
  expect(mobileAccess('worker','custom',{base:'worker',permissions:{production:['view','edit'],inventory:['view','edit']}}).inventory.edit).toBe(false);
  expect(mobileAccess('worker','owner').production.view).toBe(false);
  expect(mobileAccess('office','unknown').production.view).toBe(false);
});
it('refuses deactivated membership immediately', async () => {
  jest.mocked(sql).mockResolvedValue([{ member_data: { deactivated_at: '2026-10-09' } }] as never);
  await expect(currentMobileAccess({ userId:'u',tenantId:'t',role:'worker' },'token')).rejects.toMatchObject({status:401});
});
