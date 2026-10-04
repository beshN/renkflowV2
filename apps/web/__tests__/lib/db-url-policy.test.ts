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

  it('accepts the Vercel Marketplace PostgreSQL provider in production', () => {
    const db = loadDbModule({NODE_ENV:'production',NEXT_PHASE:'phase-production-build'});
    expect(() => db.validateDatabaseUrl('postgresql://user:pass@sample-pooler.eu-central-1.aws.neon.tech/renkflow?sslmode=require')).not.toThrow();
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
    ).toThrow('cannot target localhost');
  });

  it('accepts explicit local pilot TCP only with the local database flag', () => {
    const db = loadDbModule({NODE_ENV:'production',NEXT_PHASE:'phase-production-build',ALLOW_LOCAL_DATABASE:'1',AUTH_SECRET:'a'.repeat(32),NEXTAUTH_SECRET:'a'.repeat(32)});
    expect(()=>db.validateDatabaseUrl('postgres://user:pass@127.0.0.1:55432/renkflow_test')).not.toThrow();
    expect(()=>db.validateDatabaseUrl('postgres://user:pass@localhost/renkflow_test')).toThrow('cannot target localhost');
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
