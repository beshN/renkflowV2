/**
 * Database Transaction Utilities for PostgreSQL
 * Provides atomic operations with proper rollback support
 */

import { getSql } from '@/lib/db';

// Transaction isolation levels
export type IsolationLevel = 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';

// Transaction context passed to callback
export interface TransactionContext {
  sql: any;
  rollback: () => void;
}

// Rollback sentinel error
class RollbackError extends Error {
  constructor() {
    super('Transaction rolled back');
    this.name = 'RollbackError';
  }
}

const ALLOWED_ISOLATION_LEVELS: IsolationLevel[] = [
  'READ COMMITTED',
  'REPEATABLE READ',
  'SERIALIZABLE',
];

function sanitizeIsolationLevel(level: IsolationLevel): IsolationLevel {
  if (!ALLOWED_ISOLATION_LEVELS.includes(level)) {
    throw new Error(`Unsupported isolation level: ${level}`);
  }
  return level;
}

function sanitizeIdentifier(identifier: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }
  return identifier;
}

/**
 * Execute a function within a database transaction
 * Automatically commits on success, rolls back on any error
 * 
 * @example
 * const result = await withTransaction(async (tx) => {
 *   await tx.sql`INSERT INTO orders (name) VALUES ('Test')`;
 *   await tx.sql`INSERT INTO documents (order_id) VALUES (1)`;
 *   return { success: true };
 * });
 */
export async function withTransaction<T>(
  callback: (ctx: TransactionContext) => Promise<T>,
  options: { isolationLevel?: IsolationLevel; timeout?: number } = {}
): Promise<T> {
  if (typeof window !== 'undefined') {
    throw new Error('Transactions cannot be used in the browser');
  }

  const sql = getSql();
  if (typeof sql.begin !== 'function') {
    throw new Error('Database transaction support is not available');
  }

  const isolationLevel = sanitizeIsolationLevel(options.isolationLevel || 'READ COMMITTED');
  const timeout = options.timeout || 30000; // 30 seconds default
  
  const startTime = Date.now();

  try {
    const result = await sql.begin(async (tx: any) => {
      await tx.unsafe(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
      const rollback = () => {
        throw new RollbackError();
      };

      return new Promise<T>((resolve, reject) => {
        const timeoutId = setTimeout(
          () => reject(new Error(`Transaction timeout after ${timeout}ms`)),
          timeout
        );

        callback({ sql: tx, rollback })
          .then((value) => {
            clearTimeout(timeoutId);
            resolve(value);
          })
          .catch((error) => {
            clearTimeout(timeoutId);
            reject(error);
          });
      });
    });
    
    const duration = Date.now() - startTime;
    if (duration > 5000) {
      console.warn(`[Transaction] Slow transaction completed in ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Enhanced error logging for production debugging
    console.error('[Transaction] Failed after', duration, 'ms');
    console.error('[Transaction] Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      code: (error as any)?.code,
      constraint: (error as any)?.constraint,
      detail: (error as any)?.detail,
      hint: (error as any)?.hint,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Re-throw unless it was an intentional rollback
    if (error instanceof RollbackError) {
      throw new Error('Transaction was rolled back');
    }
    
    throw error;
  }
}

/**
 * Savepoint utilities for nested transactions
 */
export async function withSavepoint<T>(
  sql: any,
  name: string,
  callback: () => Promise<T>
): Promise<T> {
  const safeName = sanitizeIdentifier(name);
  await sql.unsafe(`SAVEPOINT ${safeName}`);
  
  try {
    const result = await callback();
    await sql.unsafe(`RELEASE SAVEPOINT ${safeName}`);
    return result;
  } catch (error) {
    await sql.unsafe(`ROLLBACK TO SAVEPOINT ${safeName}`);
    throw error;
  }
}

/**
 * Retry transaction on serialization failures
 * Useful for SERIALIZABLE isolation level
 */
export async function withRetry<T>(
  callback: () => Promise<T>,
  options: { maxRetries?: number; retryDelay?: number } = {}
): Promise<T> {
  const maxRetries = options.maxRetries || 3;
  const retryDelay = options.retryDelay || 100;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await callback();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a serialization failure (PostgreSQL error code 40001)
      const isSerializationFailure = 
        error?.code === '40001' || 
        error?.message?.includes('could not serialize');
      
      if (!isSerializationFailure || attempt === maxRetries) {
        throw error;
      }
      
      console.warn(`[Transaction] Serialization failure, retrying (${attempt}/${maxRetries})...`);
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
    }
  }
  
  throw lastError;
}

/**
 * Batch insert with transaction
 * More efficient than individual inserts
 */
export async function batchInsert<T extends Record<string, any>>(
  sql: any,
  table: string,
  records: T[],
  options: { chunkSize?: number } = {}
): Promise<void> {
  if (records.length === 0) return;
  
  const chunkSize = options.chunkSize || 100;
  const columns = Object.keys(records[0]);
  
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    
    // Build values clause
    const valuesList = chunk.map((record, idx) => {
      const offset = idx * columns.length;
      const placeholders = columns.map((_, colIdx) => `$${offset + colIdx + 1}`);
      return `(${placeholders.join(', ')})`;
    }).join(', ');
    
    // Flatten values
    const values = chunk.flatMap(record => columns.map(col => record[col]));
    
    // Execute insert
    const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${valuesList}`;
    await sql.unsafe(query, values);
  }
}
