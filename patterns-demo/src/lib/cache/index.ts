// ============================================
// CACHE MODULE BARREL EXPORTS
// ============================================

/**
 * @module cache
 * @description Enterprise-grade caching system with tenant isolation.
 * 
 * Two cache layers:
 * 1. **Enterprise Cache**: Server-side/action cache with TTL
 * 2. **Request Layer**: Client-side SWR-like cache with state management
 * 
 * @example
 * ```typescript
 * // Server actions - use enterprise cache
 * import { withCache, cacheKeys, invalidateCache } from '@/lib/cache';
 * 
 * export async function getOrdersAction(tenantId: string) {
 *   return withCache(
 *     cacheKeys.orders.list(tenantId),
 *     () => db.query.orders.findMany({ where: eq(orders.tenantId, tenantId) }),
 *     { ttl: 60000 }
 *   );
 * }
 * 
 * // Client components - use request layer
 * import { useCachedQuery, cacheKeys } from '@/lib/cache';
 * 
 * function OrderList({ tenantId }) {
 *   const { data, isLoading } = useCachedQuery(
 *     cacheKeys.orders.list(tenantId),
 *     () => getOrdersAction(tenantId)
 *   );
 * }
 * ```
 */

// Enterprise cache (server-side/action cache)
export {
  enterpriseCache,
  cacheKeys,
  withCache,
  invalidateCache,
  invalidateCachePrefix,
  invalidateTenantCache,
} from './enterprise';

// Request layer cache (client-side SWR-like)
export {
  requestCache,
  useCachedQuery,
  useCachedMutation,
  useTenantId,
  createTenantKey,
} from './request-layer';

// Re-export types
export type { } from './enterprise';
