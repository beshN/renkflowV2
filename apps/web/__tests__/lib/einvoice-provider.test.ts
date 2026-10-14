/**
 * @jest-environment node
 *
 * The mock e-Belge provider must never run in production: it would mark invoices accepted that
 * GİB never received.
 */
jest.mock('server-only', () => ({}));

describe('e-Belge provider selection', () => {
  const env = process.env;
  afterEach(() => { process.env = env; jest.resetModules(); });
  const load = async (vars: Record<string, string | undefined>) => {
    process.env = { ...env, ...vars };
    return (await import('@/lib/features/einvoice/provider')).eInvoiceProvider;
  };

  it('is off without E_INVOICE_PROVIDER', async () => {
    expect((await load({ E_INVOICE_PROVIDER: '' }))()).toBeNull();
  });
  it('gives the mock locally and in previews', async () => {
    expect((await load({ E_INVOICE_PROVIDER: 'mock', VERCEL_ENV: 'preview' }))()?.name).toBe('mock');
  });
  it('refuses the mock in production', async () => {
    expect(await load({ E_INVOICE_PROVIDER: 'mock', VERCEL_ENV: 'production' })).toThrow('production');
    jest.resetModules();
    expect(await load({ E_INVOICE_PROVIDER: 'mock', VERCEL_ENV: undefined, NODE_ENV: 'production', E_INVOICE_ALLOW_MOCK: undefined })).toThrow('production');
  });
  it('refuses an unknown provider name', async () => {
    expect(await load({ E_INVOICE_PROVIDER: 'nilvera' })).toThrow('Tanınmayan');
  });
});

describe('retry backoff', () => {
  it('doubles and stops at 6 hours', () => {
    jest.isolateModules(() => {
      jest.doMock('@/lib/db', () => ({ sql: jest.fn() }));
      jest.doMock('@/lib/db/schema-guard', () => ({ columnExists: jest.fn() }));
      jest.doMock('@/lib/audit/audit-log', () => ({ recordAudit: jest.fn() }));
      jest.doMock('@/lib/features/work-orders/security', () => ({ WorkOrderApiError: class extends Error {} }));
      const { retryDelayMinutes } = require('@/lib/features/einvoice/document.server');
      expect([1, 2, 3, 8, 9, 20].map(retryDelayMinutes)).toEqual([2, 4, 8, 256, 360, 360]);
    });
  });
});
