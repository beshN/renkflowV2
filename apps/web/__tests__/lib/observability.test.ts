/**
 * @jest-environment node
 *
 * Error tracking must not leak credentials or personal data, and readiness must check the database.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { scrubEvent, sentryDsn, sentryOptions } from '@/lib/observability/sentry-options';

const ROOT = join(__dirname, '..', '..');

describe('sentry options', () => {
  const env = process.env;
  afterEach(() => {
    process.env = env;
  });

  it('is off without a DSN', () => {
    process.env = { ...env, SENTRY_DSN: '', NEXT_PUBLIC_SENTRY_DSN: '' };
    expect(sentryDsn()).toBeUndefined();
  });

  it('prefers the server DSN and keeps tracing off by default', () => {
    process.env = { ...env, SENTRY_DSN: 'https://server@o1.ingest.sentry.io/1', NEXT_PUBLIC_SENTRY_DSN: 'https://public@o1.ingest.sentry.io/1' };
    delete process.env.SENTRY_TRACES_SAMPLE_RATE;
    delete process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE;
    const options = sentryOptions();
    expect(options.dsn).toContain('server@');
    expect(options.sendDefaultPii).toBe(false);
    expect(options.tracesSampleRate).toBe(0);
  });

  it('ignores an invalid sample rate', () => {
    process.env = { ...env, SENTRY_TRACES_SAMPLE_RATE: '5' };
    expect(sentryOptions().tracesSampleRate).toBe(0);
    process.env = { ...env, SENTRY_TRACES_SAMPLE_RATE: '0.2' };
    expect(sentryOptions().tracesSampleRate).toBe(0.2);
  });

  it('scrubs credentials, bodies and personal data', () => {
    const event = scrubEvent({
      request: {
        headers: { Authorization: 'Bearer x', Cookie: 'a=b', 'x-hub-signature-256': 's', 'user-agent': 'ua' },
        cookies: { a: 'b' },
        data: { password: 'p' },
        query_string: 'token=t',
      },
      user: { id: 'u1', email: 'a@b.c', ip_address: '1.2.3.4' },
    });
    expect(event.request?.headers).toEqual({ 'user-agent': 'ua' });
    expect(event.request).not.toHaveProperty('cookies');
    expect(event.request).not.toHaveProperty('data');
    expect(event.request).not.toHaveProperty('query_string');
    expect(event.user).toEqual({ id: 'u1' });
  });
});

describe('wiring', () => {
  it('reports server request errors and client boundary errors', () => {
    expect(readFileSync(join(ROOT, 'instrumentation.ts'), 'utf8')).toMatch(/onRequestError = Sentry\.captureRequestError/);
    for (const file of ['app/error.tsx', 'app/global-error.tsx']) {
      expect(readFileSync(join(ROOT, file), 'utf8')).toMatch(/Sentry\.captureException\(error\)/);
    }
  });

  it('serves the database-backed readiness check on /api/ready', () => {
    expect(readFileSync(join(ROOT, 'app/api/ready/route.ts'), 'utf8')).toMatch(/export \{ GET \} from '\.\.\/health\/ready\/route'/);
  });
});
