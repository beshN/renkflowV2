/**
 * Redis Session Management
 * 
 * Provides session state management using Redis:
 * - Active session tracking
 * - Multi-device session management
 * - Session invalidation
 */

import { getRedisClient, isRedisAvailable } from './client';

// ============================================
// Types
// ============================================

export interface SessionData {
  userId: string;
  email: string;
  tenantId?: string;
  userAgent: string;
  ip: string;
  createdAt: number;
  lastActivity: number;
  expiresAt: number;
}

export interface SessionInfo {
  sessionId: string;
  data: SessionData;
  isCurrentSession: boolean;
}

// ============================================
// Constants
// ============================================

const SESSION_PREFIX = 'session:';
const USER_SESSIONS_PREFIX = 'user_sessions:';
const DEFAULT_SESSION_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

// ============================================
// Session Manager
// ============================================

export class SessionManager {
  private ttl: number;

  constructor(ttlSeconds: number = DEFAULT_SESSION_TTL) {
    this.ttl = ttlSeconds;
  }

  /**
   * Create a new session
   */
  async createSession(
    sessionId: string,
    data: Omit<SessionData, 'createdAt' | 'lastActivity' | 'expiresAt'>
  ): Promise<boolean> {
    if (!(await isRedisAvailable())) {
      console.warn('[SessionManager] Redis not available, skipping session creation');
      return false;
    }

    const redis = getRedisClient();
    if (!redis) return false;
    
    const now = Date.now();
    const sessionData: SessionData = {
      ...data,
      createdAt: now,
      lastActivity: now,
      expiresAt: now + this.ttl * 1000,
    };

    try {
      const key = `${SESSION_PREFIX}${sessionId}`;
      await redis.set(key, JSON.stringify(sessionData), 'EX', this.ttl);

      // Track session under user
      const userSessionsKey = `${USER_SESSIONS_PREFIX}${data.userId}`;
      await redis.sadd(userSessionsKey, sessionId);
      await redis.expire(userSessionsKey, this.ttl);

      return true;
    } catch (error) {
      console.error('[SessionManager] Failed to create session:', error);
      return false;
    }
  }

  /**
   * Get session data
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    if (!(await isRedisAvailable())) {
      return null;
    }

    const redis = getRedisClient();
    if (!redis) return null;
    
    try {
      const key = `${SESSION_PREFIX}${sessionId}`;
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[SessionManager] Failed to get session:', error);
      return null;
    }
  }

  /**
   * Update session activity
   */
  async updateActivity(sessionId: string): Promise<boolean> {
    if (!(await isRedisAvailable())) {
      return false;
    }

    const redis = getRedisClient();
    if (!redis) return false;
    
    try {
      const key = `${SESSION_PREFIX}${sessionId}`;
      const data = await redis.get(key);
      
      if (!data) return false;

      const sessionData: SessionData = JSON.parse(data);
      sessionData.lastActivity = Date.now();
      
      await redis.set(key, JSON.stringify(sessionData), 'EX', this.ttl);
      return true;
    } catch (error) {
      console.error('[SessionManager] Failed to update activity:', error);
      return false;
    }
  }

  /**
   * Invalidate a session
   */
  async invalidateSession(sessionId: string): Promise<boolean> {
    if (!(await isRedisAvailable())) {
      return false;
    }

    const redis = getRedisClient();
    if (!redis) return false;
    try {
      const key = `${SESSION_PREFIX}${sessionId}`;
      const data = await redis.get(key);
      
      if (data) {
        const sessionData: SessionData = JSON.parse(data);
        const userSessionsKey = `${USER_SESSIONS_PREFIX}${sessionData.userId}`;
        await redis.srem(userSessionsKey, sessionId);
      }

      await redis.del(key);
      return true;
    } catch (error) {
      console.error('[SessionManager] Failed to invalidate session:', error);
      return false;
    }
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string, currentSessionId?: string): Promise<SessionInfo[]> {
    if (!(await isRedisAvailable())) {
      return [];
    }

    const redis = getRedisClient();
    if (!redis) return [];
    try {
      const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
      const sessionIds = await redis.smembers(userSessionsKey);

      const sessions: SessionInfo[] = [];
      
      for (const sessionId of sessionIds) {
        const data = await this.getSession(sessionId);
        if (data) {
          sessions.push({
            sessionId,
            data,
            isCurrentSession: sessionId === currentSessionId,
          });
        } else {
          // Clean up stale session reference
          await redis.srem(userSessionsKey, sessionId);
        }
      }

      return sessions.sort((a, b) => b.data.lastActivity - a.data.lastActivity);
    } catch (error) {
      console.error('[SessionManager] Failed to get user sessions:', error);
      return [];
    }
  }

  /**
   * Invalidate all sessions for a user except current
   */
  async invalidateOtherSessions(userId: string, currentSessionId: string): Promise<number> {
    if (!(await isRedisAvailable())) {
      return 0;
    }

    const redis = getRedisClient();
    if (!redis) return 0;
    try {
      const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
      const sessionIds = await redis.smembers(userSessionsKey);

      let invalidated = 0;
      
      for (const sessionId of sessionIds) {
        if (sessionId !== currentSessionId) {
          await this.invalidateSession(sessionId);
          invalidated++;
        }
      }

      return invalidated;
    } catch (error) {
      console.error('[SessionManager] Failed to invalidate other sessions:', error);
      return 0;
    }
  }

  /**
   * Invalidate all sessions for a user (e.g., password change)
   */
  async invalidateAllUserSessions(userId: string): Promise<number> {
    if (!(await isRedisAvailable())) {
      return 0;
    }

    const redis = getRedisClient();
    if (!redis) return 0;
    try {
      const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
      const sessionIds = await redis.smembers(userSessionsKey);

      for (const sessionId of sessionIds) {
        await redis.del(`${SESSION_PREFIX}${sessionId}`);
      }

      await redis.del(userSessionsKey);
      return sessionIds.length;
    } catch (error) {
      console.error('[SessionManager] Failed to invalidate all sessions:', error);
      return 0;
    }
  }
}

// ============================================
// Default Session Manager Instance
// ============================================

export const sessionManager = new SessionManager();
