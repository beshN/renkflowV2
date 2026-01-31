import { neon, neonConfig } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;

if (typeof window !== 'undefined') {
  throw new Error('Neon DB client cannot be used in the browser');
}

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not defined');
}

neonConfig.fetchConnectionCache = true;

export const sql = neon(databaseUrl);

/**
 * Neon Database Client
 * 
 * Usage:
 * import { sql } from '@/lib/db/neon';
 * 
 * const orders = await sql`SELECT * FROM orders`;
 */
