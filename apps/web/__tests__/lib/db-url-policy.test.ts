describe('database URL policy', () => {
  const originalEnv = process.env;

  function loadDbModule(env: Record<string, string | undefined>) {
    jest.resetModules();
    process.env = { ...originalEnv, ...env };
    return require('@/lib/db') as typeof import('@/lib/db');
  }

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects legacy host in production', () => {
    const db = loadDbModule({
      NODE_ENV: 'production',
      NEXT_PHASE: 'phase-production-build',
      AUTH_SECRET: 'a'.repeat(32),
      NEXTAUTH_SECRET: 'a'.repeat(32),
    });

    expect(() =>
      db.validateDatabaseUrl('postgresql://user:pass@sample.neon.tech/renkflow')
    ).toThrow('legacy database hosts');
  });

  it('allows a legacy host only with the explicit migration compatibility flag', () => {
    const db = loadDbModule({
      NODE_ENV: 'production',
      NEXT_PHASE: 'phase-production-build',
      ALLOW_LEGACY_DATABASE_HOSTS: '1',
      AUTH_SECRET: 'a'.repeat(32),
      NEXTAUTH_SECRET: 'a'.repeat(32),
    });

    expect(() =>
      db.validateDatabaseUrl('postgresql://user:pass@sample.neon.tech/renkflow')
    ).not.toThrow();
  });

  it('rejects localhost TCP URL without cloudsql socket in production', () => {
    const db = loadDbModule({
      NODE_ENV: 'production',
      NEXT_PHASE: 'phase-production-build',
      AUTH_SECRET: 'a'.repeat(32),
      NEXTAUTH_SECRET: 'a'.repeat(32),
    });

    expect(() =>
      db.validateDatabaseUrl('postgresql://user:pass@localhost/renkflow?sslmode=disable')
    ).toThrow('requires Cloud SQL socket');
  });

  it('accepts localhost URL when cloudsql socket query exists in production', () => {
    const db = loadDbModule({
      NODE_ENV: 'production',
      NEXT_PHASE: 'phase-production-build',
      AUTH_SECRET: 'a'.repeat(32),
      NEXTAUTH_SECRET: 'a'.repeat(32),
    });

    expect(() =>
      db.validateDatabaseUrl(
        'postgresql://user:pass@localhost/renkflow?host=/cloudsql/project:region:instance&sslmode=disable'
      )
    ).not.toThrow();
  });

  it('rejects non-postgres protocol', () => {
    const db = loadDbModule({
      NODE_ENV: 'development',
      NEXT_PHASE: 'phase-production-build',
      AUTH_SECRET: 'a'.repeat(32),
      NEXTAUTH_SECRET: 'a'.repeat(32),
    });

    expect(() => db.validateDatabaseUrl('mysql://user:pass@host/db')).toThrow('Invalid protocol');
  });
});
