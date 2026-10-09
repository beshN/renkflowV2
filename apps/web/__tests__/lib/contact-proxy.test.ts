/** @jest-environment node */
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
jest.mock('next-auth/jwt', () => ({ getToken: jest.fn(async () => null) }));
const prior = { private: process.env.PRIVATE_ACCESS_EMAIL, mode: process.env.PUBLIC_SITE_MODE };
afterEach(() => {
  for (const [key, value] of [['PRIVATE_ACCESS_EMAIL', prior.private], ['PUBLIC_SITE_MODE', prior.mode]]) {
    if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
  }
});
it('allows public contact in private pilot mode while protecting business APIs', async () => {
  process.env.PRIVATE_ACCESS_EMAIL = 'owner@example.invalid';
  process.env.PUBLIC_SITE_MODE = 'off';
  const contact = await proxy(new NextRequest('https://renkflow.com/api/contact', { method: 'POST' }));
  expect(contact.headers.get('x-middleware-next')).toBe('1');
  for (const path of ['/api/v1/orders', '/api/contact/internal']) {
    expect((await proxy(new NextRequest('https://renkflow.com' + path))).status).toBe(401);
  }
});
