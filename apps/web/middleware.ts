/**
 * Next.js Edge Middleware
 *
 * Delegates all request processing to the proxy module which handles:
 * - Authentication & route protection
 * - Rate limiting on auth endpoints
 * - HTTPS enforcement
 * - Healthcheck bypass for Railway
 * - Coming-soon mode gating
 * - Security headers
 */

export { proxy as middleware, config } from '@/proxy';
