jest.mock("server-only", () => ({}));
const sqlMock = jest.fn();

jest.mock('@/lib/db', () => ({
  getSql: () => sqlMock,
}));

import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
  resetRateLimit,
  RATE_LIMIT_POLICIES,
} from '@/lib/security/rate-limit';

function headers(values: Record<string, string>) {
  return new Headers(values);
}

describe('shared rate limiter', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the database counter and never stores the raw subject', async () => {
    sqlMock.mockResolvedValueOnce([{ hits: 3 }]);
    const result = await consumeRateLimit('register', '203.0.113.9');

    expect(result).toMatchObject({ allowed: true, remaining: RATE_LIMIT_POLICIES.register.limit - 3 });
    const values = sqlMock.mock.calls[0].slice(1);
    expect(values[0]).toMatch(/^register:[0-9a-f]{64}$/);
    expect(JSON.stringify(values)).not.toContain('203.0.113.9');
  });

  it('blocks once the shared counter exceeds the policy limit', async () => {
    sqlMock.mockResolvedValueOnce([{ hits: RATE_LIMIT_POLICIES.register.limit + 1 }]);
    const result = await consumeRateLimit('register', '203.0.113.9');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(rateLimitHeaders(result)['Retry-After']).toBe(String(result.retryAfterSeconds));
  });

  it('falls back to per-instance memory windows when the database fails', async () => {
    sqlMock.mockRejectedValue(new Error('relation "rate_limit_buckets" does not exist'));
    const { limit } = RATE_LIMIT_POLICIES.subscribe;
    const subject = `fallback-${Date.now()}`;

    for (let attempt = 0; attempt < limit; attempt += 1) {
      expect((await consumeRateLimit('subscribe', subject)).allowed).toBe(true);
    }
    expect((await consumeRateLimit('subscribe', subject)).allowed).toBe(false);

    await resetRateLimit('subscribe', subject);
    expect((await consumeRateLimit('subscribe', subject)).allowed).toBe(true);
  });

  it('keys subjects case-insensitively', async () => {
    sqlMock.mockResolvedValue([{ hits: 1 }]);
    await consumeRateLimit('loginAccount', 'User@Example.com');
    await consumeRateLimit('loginAccount', 'user@example.com ');
    expect(sqlMock.mock.calls[0][1]).toBe(sqlMock.mock.calls[1][1]);
  });
});

describe('getClientIp', () => {
  it('prefers the platform-set x-real-ip header', () => {
    expect(getClientIp(headers({ 'x-real-ip': '198.51.100.7', 'x-forwarded-for': '10.0.0.1' }))).toBe('198.51.100.7');
  });

  it('ignores cf-connecting-ip, which clients can forge outside Cloudflare', () => {
    expect(getClientIp(headers({ 'cf-connecting-ip': '1.2.3.4', 'x-forwarded-for': '198.51.100.8, 10.0.0.1' }))).toBe('198.51.100.8');
  });

  it('returns unknown when no address header is present', () => {
    expect(getClientIp(headers({}))).toBe('unknown');
  });
});
