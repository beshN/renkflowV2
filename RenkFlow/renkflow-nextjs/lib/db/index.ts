import { neon } from '@neondatabase/serverless';

export function getSql() {
  if (!process.env.DATABASE_URL) {
    // During build time or if env var is missing, prevent crash
    // but ensure runtime failures if connection needed
    // This allows static analysis to pass without throwing 'Error: No database connection string provided'
    if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
        try {
            return neon(process.env.DATABASE_URL || '');
        } catch(e) {
            console.warn('Database connection string missing during initialization');
            // Return a proxy that throws on usage, not on init
            return new Proxy({}, {
                get: () => { throw new Error('Database connection failed: DATABASE_URL is missing') }
            }) as any;
        }
    }
    
    // Fallback for clearer error in dev/runtime
    throw new Error('DATABASE_URL is not defined');
  }
  return neon(process.env.DATABASE_URL);
}

// Singleton-ish pattern if preferred, or just a safe exporter
// The key is to NOT call neon() if DATABASE_URL is undefined at module scope
export const sql = process.env.DATABASE_URL 
  ? neon(process.env.DATABASE_URL) 
  : (new Proxy({}, {
      get: () => { 
        if (typeof window === 'undefined') { // Server-side check
             throw new Error('DATABASE_URL is missing. Please check your environment variables.');
        }
        return undefined;
      }
    }) as any);
