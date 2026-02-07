/**
 * Redis Module Exports
 */

export { getRedisClient, closeRedisConnection, isRedisAvailable } from './client';
export { sessionManager, SessionManager } from './session';
export type { SessionData, SessionInfo } from './session';
