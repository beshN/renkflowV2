/** @jest-environment node */
import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { consumeRateLimit } from '@/lib/security/rate-limit';

const mockSend = jest.fn();
jest.mock('resend', () => ({ Resend: jest.fn(() => ({ emails: { send: mockSend } })) }));
jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
jest.mock('@/lib/security/rate-limit', () => ({ consumeRateLimit: jest.fn(), getClientIp: () => '127.0.0.1', rateLimitHeaders: () => ({ 'Retry-After': '60' }) }));
const payload = { name: 'Test Kullanıcı', email: 'test@example.invalid', subject: 'sales', message: 'Demo görüşmesi yapmak istiyorum.' };
const request = (body = payload) => new NextRequest('https://renkflow.com/api/contact', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
let POST: typeof import('@/app/api/contact/route').POST;
const originalKey = process.env.RESEND_API_KEY;
beforeAll(async () => { process.env.RESEND_API_KEY = 're_local_test_only'; POST = (await import('@/app/api/contact/route')).POST; });
afterAll(() => { if (originalKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = originalKey; });
beforeEach(() => {
  jest.clearAllMocks();
  (consumeRateLimit as jest.Mock).mockResolvedValue({ allowed: true });
  (sql as unknown as jest.Mock).mockResolvedValue([{ id: 'ticket-1' }]);
  mockSend.mockResolvedValue({ data: { id: 'mail-1' }, error: null });
});
it('never reports success or sends confirmation when persistence fails', async () => {
  (sql as unknown as jest.Mock).mockRejectedValue(new Error('database unavailable'));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect((await response.json()).success).toBeUndefined();
  expect(mockSend).not.toHaveBeenCalled();
});
it('retains acceptance of a saved ticket when the mail provider rejects it', async () => {
  mockSend.mockResolvedValue({ data: null, error: { name: 'validation_error' } });
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ success: true, ticketId: 'ticket-1', emailDelivered: false });
});
it('does not tell users to resubmit saved tickets after mail transport failures', async () => {
  mockSend.mockRejectedValue(new Error('network unavailable'));
  expect(await (await POST(request())).json()).toMatchObject({ success: true, emailDelivered: false });
});
it('reports delivery only after the support mail was accepted', async () => {
  expect(await (await POST(request())).json()).toMatchObject({ success: true, emailDelivered: true });
  expect(mockSend).toHaveBeenCalledTimes(2);
});
it('does not associate public messages with supplied tenant/user identities', async () => {
  await POST(request({ ...payload, tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } as typeof payload));
  const args = (sql as unknown as jest.Mock).mock.calls[0];
  expect(args.slice(1, 3)).toEqual([null, null]);
});
it('rejects invalid messages and rate-limited requests before persistence', async () => {
  expect((await POST(request({ ...payload, message: 'x' }))).status).toBe(400);
  (consumeRateLimit as jest.Mock).mockResolvedValue({ allowed: false });
  const limited = await POST(request());
  expect(limited.status).toBe(429);
  expect(limited.headers.get('Retry-After')).toBe('60');
  expect(sql).not.toHaveBeenCalled();
});
