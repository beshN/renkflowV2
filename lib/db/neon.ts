import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;

// Create a safe wrapper that doesn't crash on client-side import
const sql: any = databaseUrl 
  ? neon(databaseUrl)
  : () => {
      console.warn('Attempted to use Neon DB client on client-side or without DATABASE_URL');
      return Promise.reject(new Error('Database not configured'));
    };

export { sql };

/**
 * Neon Database Client
 * 
 * Usage:
 * import { sql } from '@/lib/db/neon';
 * 
 * const orders = await sql`SELECT * FROM orders`;
 */
