/** @jest-environment node */
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
jest.mock('next-auth/jwt', () => ({ getToken: jest.fn(async () => null) }));
it('delegates only versioned mobile endpoints to their bearer guards during a private pilot', async () => {
  const previous = process.env.PRIVATE_ACCESS_EMAIL;
  process.env.PRIVATE_ACCESS_EMAIL = 'pilot@example.invalid';
  try {
    for (const path of ['/api/mobile/v1/auth/login','/api/mobile/v1/snapshot']) {
      expect((await proxy(new NextRequest('https://renkflow.com' + path))).headers.get('x-middleware-next')).toBe('1');
    }
    for (const path of ['/api/mobile/v2/snapshot','/api/mobile/v1other','/api/v1/orders']) {
      expect((await proxy(new NextRequest('https://renkflow.com' + path))).status).toBe(401);
    }
  } finally { if (previous === undefined) delete process.env.PRIVATE_ACCESS_EMAIL; else process.env.PRIVATE_ACCESS_EMAIL = previous; }
});
