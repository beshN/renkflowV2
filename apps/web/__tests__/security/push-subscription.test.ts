/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
jest.mock('@/lib/email', () => ({ sendEmail: jest.fn() }));
jest.mock('@/lib/features/work-orders/security', () => { const actual = jest.requireActual('@/lib/features/work-orders/security'); return { ...actual, requireWorkOrderActor: jest.fn() }; });
import { NextRequest } from 'next/server';
import { POST, DELETE } from '@/app/api/notifications/subscribe/route';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { isBrowserPushEndpoint } from '@/lib/notifications/push-validation';
import { savePushSubscription } from '@/lib/notifications/service';
import { sql } from '@/lib/db';
const endpoint = 'https://fcm.googleapis.com/fcm/send/example-token';
const keys = { p256dh: Buffer.alloc(65, 4).toString('base64url'), auth: Buffer.alloc(16, 2).toString('base64url') };
const actor = { userId: 'current-user', tenantId: 'firm', role: 'worker' as const };
const request = (method: string, body: unknown, headers = {}) => new NextRequest('https://renkflow.example/api/notifications/subscribe', { method, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
beforeEach(() => { jest.clearAllMocks(); jest.mocked(requireWorkOrderActor).mockResolvedValue(actor); jest.mocked(sql).mockResolvedValue([{ endpoint }] as never); });
it('deletes only the current user’s endpoint even if another userId is supplied', async () => {
  expect((await DELETE(request('DELETE', { endpoint, userId: 'victim' }))).status).toBe(200);
  const [query, ...values] = jest.mocked(sql).mock.calls[0];
  expect((query as unknown as string[]).join('?')).toMatch(/WHERE endpoint = \? AND user_id = \?/);
  expect(values).toEqual([endpoint, actor.userId]);
});
it('cannot overwrite another user’s push keys through endpoint conflict', async () => {
  jest.mocked(sql).mockResolvedValue([] as never);
  await expect(savePushSubscription(actor.userId, { userId: 'victim', endpoint, ...keys })).rejects.toMatchObject({ status: 409 });
  expect((jest.mocked(sql).mock.calls[0][0] as unknown as string[]).join('?')).toContain('WHERE push_subscriptions.user_id = ?');
});
it('stores a validated subscription with the authenticated user and rejects malformed keys', async () => {
  expect((await POST(request('POST', { endpoint, keys, userId: 'victim' }))).status).toBe(200);
  expect(jest.mocked(sql).mock.calls[0]).toContain(actor.userId);
  jest.mocked(sql).mockClear();
  expect((await POST(request('POST', { endpoint, keys: { ...keys, auth: 'short' } }))).status).toBe(400);
  expect(sql).not.toHaveBeenCalled();
});
it.each(['http://127.0.0.1/private', 'https://169.254.169.254/latest/meta-data', 'https://[::1]/private', 'https://evil.invalid/private', 'https://fcm.googleapis.com.evil.invalid/x', 'https://fcm.googleapis.com@evil.invalid/x', 'https://fcm.googleapis.com:444/x', 'https://fcm.googleapis.com/x#fragment'])('blocks non-provider or deceptive endpoints %s', async endpoint => {
  expect(isBrowserPushEndpoint(endpoint)).toBe(false);
  expect((await POST(request('POST', { endpoint, keys }))).status).toBe(400);
  expect(sql).not.toHaveBeenCalled();
});
it.each(['https://updates.push.services.mozilla.com/wpush/v2/token', 'https://web.push.apple.com/token', 'https://cloud.notify.windows.com/?token=x', endpoint])('accepts supported browser providers %s', endpoint => expect(isBrowserPushEndpoint(endpoint)).toBe(true));
it('refuses foreign origins and revoked membership before touching subscriptions', async () => {
  expect((await DELETE(request('DELETE', { endpoint }, { origin: 'https://evil.invalid' }))).status).toBe(403);
  expect(requireWorkOrderActor).not.toHaveBeenCalled();
  jest.mocked(requireWorkOrderActor).mockRejectedValue(new WorkOrderApiError('Oturum gerekli.', 401));
  expect((await POST(request('POST', { endpoint, keys }))).status).toBe(401);
  expect(sql).not.toHaveBeenCalled();
});
