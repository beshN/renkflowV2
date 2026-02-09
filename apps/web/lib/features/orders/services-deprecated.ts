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
import { PostgresOrderService } from './postgres/order.postgres';
import { WebOrderService } from './web/order.web';

/**
 * ⚠️ DEPRECATED: Runtime service factory
 * 
 * This pattern will be removed in v2.0. Use orderService.server.ts
 * or orderService.client.ts instead.
 */
const isBrowser = typeof window !== 'undefined';
const isDatabaseConfigured = process.env.NEXT_PUBLIC_USE_DATABASE === 'true' || !!process.env.DATABASE_URL;

export const orderService: IOrderService = isBrowser
  ? new WebOrderService()
  : isDatabaseConfigured
    ? new PostgresOrderService()
    : new MockOrderService();

console.warn('[DEPRECATION WARNING] Runtime service factory is deprecated. Migrate to server/client split');

// Re-export types for convenience
export type { IOrderService } from './types';
export { MockOrderService } from './mock/order.mock';
export { PostgresOrderService } from './postgres/order.postgres';
export { WebOrderService } from './web/order.web';

// Re-export new entry points for migration
export { orderService as serverOrderService } from './orderService.server';
export { orderService as clientOrderService } from './orderService.client';
