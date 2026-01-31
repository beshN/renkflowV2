/**
 * Database Transaction Utilities for Neon
 * Provides atomic operations with proper rollback support
 */

import { neon, NeonQueryFunction } from '@neondatabase/serverless';

// Transaction isolation levels
export type IsolationLevel = 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';

// Transaction context passed to callback
export interface TransactionContext {
  sql: NeonQueryFunction<false, false>;
  rollback: () => void;
}

// Rollback sentinel error
class RollbackError extends Error {
  constructor() {
    super('Transaction rolled back');
    this.name = 'RollbackError';
  }
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
  options: { isolationLevel?: IsolationLevel } = {}
): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not configured');
  }

  // Create a dedicated connection for this transaction
  const sql = neon(databaseUrl);
  const isolationLevel = options.isolationLevel || 'READ COMMITTED';
  
  let shouldRollback = false;
  
  const rollback = () => {
    shouldRollback = true;
    throw new RollbackError();
  };

  try {
    // Start transaction with isolation level
    await sql`BEGIN TRANSACTION ISOLATION LEVEL ${sql(isolationLevel)}`;
    
    // Execute the callback
    const result = await callback({ sql, rollback });
    
    // Commit if no errors
    await sql`COMMIT`;
    
    return result;
  } catch (error) {
    // Always rollback on error
    try {
      await sql`ROLLBACK`;
    } catch (rollbackError) {
      console.error('[Transaction] Rollback failed:', rollbackError);
    }
    
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
  sql: NeonQueryFunction<false, false>,
  name: string,
  callback: () => Promise<T>
): Promise<T> {
  await sql`SAVEPOINT ${sql(name)}`;
  
  try {
    const result = await callback();
    await sql`RELEASE SAVEPOINT ${sql(name)}`;
    return result;
  } catch (error) {
    await sql`ROLLBACK TO SAVEPOINT ${sql(name)}`;
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
  sql: NeonQueryFunction<false, false>,
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
    await sql(query, values);
  }
}
