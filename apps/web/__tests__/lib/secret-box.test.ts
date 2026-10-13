/**
 * @jest-environment node
 *
 * Third-party secrets (SSO client secrets, later integrator credentials) are stored sealed.
 */
jest.mock('server-only', () => ({}));

describe('secret box', () => {
  const env = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...env, AUTH_SECRET: 'x'.repeat(48) };
  });
  afterAll(() => {
    process.env = env;
  });

  it('round-trips and never stores the plain value', async () => {
    const { sealSecret, openSecret } = await import('@/lib/security/secret-box');
    const sealed = sealSecret('client-secret-123', 'sso');
    expect(sealed).toMatch(/^sealed:v1:/);
    expect(sealed).not.toContain('client-secret-123');
    expect(openSecret(sealed, 'sso')).toBe('client-secret-123');
  });

  it('uses a fresh IV each time', async () => {
    const { sealSecret } = await import('@/lib/security/secret-box');
    expect(sealSecret('same', 'sso')).not.toBe(sealSecret('same', 'sso'));
  });

  it('binds the value to its purpose', async () => {
    const { sealSecret, openSecret } = await import('@/lib/security/secret-box');
    expect(() => openSecret(sealSecret('v', 'sso'), 'einvoice')).toThrow();
  });

  it('rejects tampered values', async () => {
    const { sealSecret, openSecret } = await import('@/lib/security/secret-box');
    const sealed = sealSecret('value', 'sso');
    const bytes = Buffer.from(sealed.slice('sealed:v1:'.length), 'base64');
    bytes[bytes.length - 1] ^= 1;
    expect(() => openSecret(`sealed:v1:${bytes.toString('base64')}`, 'sso')).toThrow();
  });

  it('passes legacy plain values and empty values through', async () => {
    const { openSecret } = await import('@/lib/security/secret-box');
    expect(openSecret('legacy-plain', 'sso')).toBe('legacy-plain');
    expect(openSecret(null, 'sso')).toBeNull();
  });
});
