/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/schema-guard', () => ({ columnExists: jest.fn(async () => true), tableExists: jest.fn(async () => true) }));
jest.mock('@/lib/security/member-access.server', () => ({ forgetSessions: jest.fn() }));
jest.mock('@/lib/security/rate-limit', () => ({
  consumeRateLimit: jest.fn(async () => ({ allowed: true })),
  getClientIp: () => '203.0.113.7',
  rateLimitResponse: () => Response.json({ error: 'limit' }, { status: 429 }),
}));
jest.mock('bcryptjs', () => ({ hash: jest.fn(async () => 'hashed') }));

type Call = { text: string; inTx: boolean };
let calls: Call[] = [];
let tokenSpent = false;
let failOn: RegExp | null = null;
let committed: Call[] = [];

const answer = (text: string) => {
  if (failOn?.test(text)) throw new Error('injected failure');
  if (/^SELECT id, email, name FROM users/i.test(text)) return [{ id: 'user-1', email: 'ayse@example.invalid', name: 'Ayşe' }];
  if (/^UPDATE users SET password =/i.test(text)) {
    if (tokenSpent) return [];
    tokenSpent = true;
    return [{ id: 'user-1' }];
  }
  return [];
};
const tag = (inTx: boolean, log: Call[]) => async (strings: TemplateStringsArray, ..._values: unknown[]) => {
  const text = strings.join('$X').replace(/\s+/g, ' ').trim();
  log.push({ text, inTx });
  return answer(text);
};
jest.mock('@/lib/db', () => ({
  sql: (...args: any[]) => (tag(false, calls) as any)(...args),
  // A transaction stand-in: its statements count only when the callback returns.
  withTransaction: async (fn: (tx: any) => unknown) => {
    const pending: Call[] = [];
    const before = tokenSpent;
    try {
      const result = await fn(tag(true, pending));
      calls.push(...pending);
      committed.push(...pending);
      return result;
    } catch (error) {
      tokenSpent = before; // rolled back
      calls.push(...pending);
      throw error;
    }
  },
}));

import { POST } from '@/app/api/auth/reset-password/route';
import { forgetSessions } from '@/lib/security/member-access.server';
import { tableExists } from '@/lib/db/schema-guard';

const reset = () =>
  POST(new Request('https://renkflow.com/api/auth/reset-password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: 'a'.repeat(64), password: 'Uzun-sifre-2026x' }) }));

beforeEach(() => {
  calls = [];
  committed = [];
  tokenSpent = false;
  failOn = null;
  (forgetSessions as jest.Mock).mockClear();
  (tableExists as jest.Mock).mockResolvedValue(true);
});

describe('reset password', () => {
  it('spends the token, sets the password and closes every sign-in in one transaction', async () => {
    const res = await reset();
    expect(res.status).toBe(200);
    const tx = committed.map((c) => c.text);
    expect(tx[0]).toMatch(/^UPDATE users SET password = .*AND password_reset_token = \$X AND password_reset_expires > NOW\(\) RETURNING id$/);
    expect(tx).toEqual(expect.arrayContaining([
      expect.stringMatching(/UPDATE users SET sessions_valid_after = now\(\)/),
      expect.stringMatching(/UPDATE user_sessions SET revoked_at = now\(\)/),
      expect.stringMatching(/DELETE FROM mobile_refresh_tokens/),
    ]));
    expect(calls.filter((c) => !c.inTx && /UPDATE|DELETE/.test(c.text))).toEqual([]);
    expect(forgetSessions).toHaveBeenCalledWith('user-1');
  });

  it('answers the invalid-link error to the second request with the same token', async () => {
    expect((await reset()).status).toBe(200);
    const second = await reset();
    // The pre-check SELECT is mocked to still find the row: the conditional UPDATE is what decides.
    expect(second.status).toBe(400);
    expect(await second.json()).toEqual({ error: 'token_expired' });
    expect(forgetSessions).toHaveBeenCalledTimes(1);
  });

  it('rolls back and reports an error when closing sessions fails', async () => {
    failOn = /UPDATE user_sessions/;
    const res = await reset();
    expect(res.status).toBe(500);
    expect(tokenSpent).toBe(false);
    expect(committed).toEqual([]);
    expect(forgetSessions).not.toHaveBeenCalled();
    // The link still works once the database is healthy again.
    failOn = null;
    expect((await reset()).status).toBe(200);
  });

  it('skips tables a database does not have yet', async () => {
    (tableExists as jest.Mock).mockResolvedValue(false);
    expect((await reset()).status).toBe(200);
    expect(committed.some((c) => /mobile_refresh_tokens|user_sessions/.test(c.text))).toBe(false);
  });
});
