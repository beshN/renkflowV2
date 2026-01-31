/**
 * Service Layer Entry Point (DEPRECATED)
 * 
 * ⚠️ WARNING: This file uses runtime service selection which is error-prone.
 * 
 * 🔄 MIGRATION GUIDE:
 * - Server-side code (Server Actions, API routes): 
 *   Import from '@/lib/services/orderService.server'
 * 
 * - Client-side code (Components, Hooks):
 *   Import from '@/lib/services/orderService.client'
 * 
 * The new pattern uses:
 * - 'server-only' and 'client-only' directives for compile-time safety
 * - Build-time service selection instead of runtime
 * - Fail-fast validation for missing configuration
 * 
 * This file is kept for backward compatibility but will be removed in v2.0.
 */

import { IOrderService } from './types';
import { MockOrderService } from './mock/order.mock';
import { NeonOrderService } from './neon/order.neon';
import { WebOrderService } from './web/order.web';

/**
 * ⚠️ DEPRECATED: Runtime service factory
 * 
 * This pattern has several issues:
 * 1. Cannot guarantee server code doesn't leak to client bundle
 * 2. Runtime checks are harder to debug and test
 * 3. Relies on NEXT_PUBLIC_* env vars (security concern)
 * 
 * Use orderService.server.ts or orderService.client.ts instead.
 */
const isBrowser = typeof window !== 'undefined';
const isDatabaseConfigured = process.env.NEXT_PUBLIC_USE_DATABASE === 'true' || !!process.env.DATABASE_URL;

export const orderService: IOrderService = isBrowser
  ? new WebOrderService()
  : isDatabaseConfigured
    ? new NeonOrderService()
    : new MockOrderService();

// Re-export types for convenience
export type { IOrderService } from './types';

// Re-export new entry points for migration
export { getOrderService as getServerOrderService } from './orderService.server';
export { getOrderService as getClientOrderService } from './orderService.client';


