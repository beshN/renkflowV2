import { neon, neonConfig } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
const IS_BUILD_TIME = process.env.NEXT_PHASE === 'phase-production-build';

if (typeof window !== 'undefined') {
  throw new Error('Neon DB client cannot be used in the browser');
}

if (!databaseUrl && !IS_BUILD_TIME) {
  throw new Error('DATABASE_URL is not defined');
}

neonConfig.fetchConnectionCache = true;

// Return dummy function during build time
export const sql = databaseUrl 
  ? neon(databaseUrl) 
  : ((() => Promise.resolve([])) as unknown as ReturnType<typeof neon>);

/**
 * Neon Database Client
 * 
 * Usage:
 * import { sql } from '@/lib/db/neon';
 * 
 * const orders = await sql`SELECT * FROM orders`;
 */
