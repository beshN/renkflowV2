describe('runtime-env helpers', () => {
  const originalEnv = process.env;

  function loadModule(env: Record<string, string | undefined>) {
    jest.resetModules();
    process.env = { ...originalEnv, ...env };
    return require('@/lib/shared/config/runtime-env') as typeof import('@/lib/shared/config/runtime-env');
  }

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('resolves AUTH_SECRET when configured', () => {
    const runtimeEnv = loadModule({
      NODE_ENV: 'production',
      AUTH_SECRET: 'a'.repeat(32),
      NEXTAUTH_SECRET: 'a'.repeat(32),
    });

    const value = runtimeEnv.resolveAuthSecret({ context: 'test' });
    expect(value).toBe('a'.repeat(32));
  });

  it('throws in production when auth secrets mismatch', () => {
    const runtimeEnv = loadModule({
      NODE_ENV: 'production',
      AUTH_SECRET: 'a'.repeat(32),
      NEXTAUTH_SECRET: 'b'.repeat(32),
    });

    expect(() => runtimeEnv.resolveAuthSecret({ context: 'test' })).toThrow(
      'AUTH_SECRET and NEXTAUTH_SECRET must match'
    );
  });

  it('resolves server base URL from AUTH_URL', () => {
    const runtimeEnv = loadModule({
      NODE_ENV: 'production',
      AUTH_SECRET: 'a'.repeat(32),
      NEXTAUTH_SECRET: 'a'.repeat(32),
      AUTH_URL: 'https://renkflow-web.example.run.app',
    });

    const value = runtimeEnv.resolveServerBaseUrl({ context: 'test' });
    expect(value).toBe('https://renkflow-web.example.run.app');
  });

  it('throws for localhost URL in production', () => {
    const runtimeEnv = loadModule({
      NODE_ENV: 'production',
      AUTH_SECRET: 'a'.repeat(32),
      NEXTAUTH_SECRET: 'a'.repeat(32),
      AUTH_URL: 'http://localhost:3000',
    });

    expect(() => runtimeEnv.resolveServerBaseUrl({ context: 'test' })).toThrow(
      'Production URL cannot point to localhost'
    );
  });
});
