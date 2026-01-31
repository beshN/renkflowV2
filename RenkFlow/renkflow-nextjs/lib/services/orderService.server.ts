/**
 * Server-Only Order Service Entry Point
 * 
 * This file can ONLY be imported from server-side code.
 * Next.js will throw an error if this is imported from client code.
 * 
 * Pattern: Build-time service selection with fail-fast validation
 */

import 'server-only';

import { IOrderService } from './types';
import { NeonOrderService } from './neon/order.neon';
import { MockOrderService } from './mock/order.mock';

// Environment detection
const IS_TEST = process.env.NODE_ENV === 'test';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DATABASE_URL = process.env.DATABASE_URL;

/**
 * Get the appropriate order service based on environment.
 * 
 * Rules:
 * - Test environment: Always use MockOrderService
 * - Production without DATABASE_URL: Fail fast with clear error
 * - Development: Use MockOrderService if no DATABASE_URL
 * - Otherwise: Use NeonOrderService (PostgreSQL)
 */
function createServerOrderService(): IOrderService {
  // Test environment always uses mock
  if (IS_TEST) {
    console.log('[RenkFlow] Test environment detected, using MockOrderService');
    return new MockOrderService();
  }

  // Production: Fail fast if DATABASE_URL is missing
  if (IS_PRODUCTION && !DATABASE_URL) {
    throw new Error(
      '[RenkFlow] FATAL: DATABASE_URL is not defined in production. ' +
      'Please configure your database connection.'
    );
  }

  // Development without DB: Use mock with warning
  if (!DATABASE_URL) {
    console.warn(
      '[RenkFlow] Warning: DATABASE_URL not set, using MockOrderService. ' +
      'Set DATABASE_URL to use PostgreSQL.'
    );
    return new MockOrderService();
  }

  // Validate DATABASE_URL format
  try {
    const url = new URL(DATABASE_URL);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
      throw new Error(`Invalid protocol: ${url.protocol}`);
    }
  } catch (error) {
    throw new Error(
      `[RenkFlow] FATAL: Invalid DATABASE_URL format. ` +
      `Expected: postgresql://... Got error: ${error}`
    );
  }

  console.log('[RenkFlow] Using NeonOrderService (PostgreSQL)');
  return new NeonOrderService();
}

// Singleton instance
let serverOrderService: IOrderService | null = null;

/**
 * Get the server-side order service instance.
 * This is a singleton that is created once per server process.
 */
export function getOrderService(): IOrderService {
  if (!serverOrderService) {
    serverOrderService = createServerOrderService();
  }
  return serverOrderService;
}

/**
 * Reset the service instance (useful for testing).
 */
export function resetOrderService(): void {
  serverOrderService = null;
}

/**
 * Direct export for convenience in Server Actions.
 * Note: This will fail if imported from client code due to 'server-only'.
 */
export const orderService = getOrderService();
