// ============================================
// 5. AUTHENTICATION FLOW
// JWT Refresh Token Rotation with HttpOnly Cookies
// ============================================

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

// ============================================
// TYPES
// ============================================

export interface TokenPayload extends JWTPayload {
  userId: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  sessionId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  userAgent?: string;
  ipAddress?: string;
  isRevoked: boolean;
  replacedByTokenId?: string;
}

// ============================================
// CONFIGURATION
// ============================================

/**
 * JWT Configuration
 * SECURITY: No fallback secrets - app must fail if secrets not configured
 */
function getConfig() {
  const accessSecret = process.env.ACCESS_TOKEN_SECRET;
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET;

  if (!accessSecret || accessSecret.length < 32) {
    throw new Error(
      'ACCESS_TOKEN_SECRET environment variable must be set and at least 32 characters. ' +
      'Generate with: openssl rand -base64 32'
    );
  }

  if (!refreshSecret || refreshSecret.length < 32) {
    throw new Error(
      'REFRESH_TOKEN_SECRET environment variable must be set and at least 32 characters. ' +
      'Generate with: openssl rand -base64 32'
    );
  }

  return {
    accessTokenSecret: new TextEncoder().encode(accessSecret),
    refreshTokenSecret: new TextEncoder().encode(refreshSecret),
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
    issuer: 'patterns-demo',
    audience: 'patterns-demo-client',
  };
}

// Lazy initialization to allow environment setup
let configCache: ReturnType<typeof getConfig> | null = null;

function getConfigSafe() {
  if (!configCache) {
    configCache = getConfig();
  }
  return configCache;
}

// ============================================
// TOKEN GENERATION
// ============================================

export async function generateAccessToken(payload: Omit<TokenPayload, 'iat' | 'exp' | 'iss' | 'aud'>): Promise<string> {
  const config = getConfigSafe();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(config.accessTokenExpiry)
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .sign(config.accessTokenSecret);
}

export async function generateRefreshToken(payload: Pick<TokenPayload, 'userId' | 'sessionId'>): Promise<string> {
  const config = getConfigSafe();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(config.refreshTokenExpiry)
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setJti(crypto.randomUUID()) // Unique token ID for rotation tracking
    .sign(config.refreshTokenSecret);
}

export async function generateTokenPair(
  user: { id: string; email: string; role: 'admin' | 'user' | 'guest' }
): Promise<TokenPair> {
  const sessionId = crypto.randomUUID();
  
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId,
    }),
    generateRefreshToken({
      userId: user.id,
      sessionId,
    }),
  ]);

  return { accessToken, refreshToken };
}

// ============================================
// TOKEN VERIFICATION
// ============================================

export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const config = getConfigSafe();
    const { payload } = await jwtVerify(token, config.accessTokenSecret, {
      issuer: config.issuer,
      audience: config.audience,
    });
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<(TokenPayload & { jti: string }) | null> {
  try {
    const config = getConfigSafe();
    const { payload } = await jwtVerify(token, config.refreshTokenSecret, {
      issuer: config.issuer,
      audience: config.audience,
    });
    return payload as TokenPayload & { jti: string };
  } catch {
    return null;
  }
}

// ============================================
// TOKEN ROTATION SERVICE
// ============================================

export class TokenRotationService {
  // In production, this would be a database
  private refreshTokenStore = new Map<string, RefreshTokenRecord>();
  
  async storeRefreshToken(
    userId: string,
    tokenId: string,
    tokenHash: string,
    metadata?: { userAgent?: string; ipAddress?: string }
  ): Promise<void> {
    const record: RefreshTokenRecord = {
      id: tokenId,
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: new Date(),
      userAgent: metadata?.userAgent,
      ipAddress: metadata?.ipAddress,
      isRevoked: false,
    };
    
    this.refreshTokenStore.set(tokenId, record);
  }
  
  async getRefreshToken(tokenId: string): Promise<RefreshTokenRecord | null> {
    return this.refreshTokenStore.get(tokenId) ?? null;
  }
  
  async revokeRefreshToken(tokenId: string): Promise<void> {
    const record = this.refreshTokenStore.get(tokenId);
    if (record) {
      record.isRevoked = true;
    }
  }
  
  async revokeAllUserTokens(userId: string): Promise<void> {
    for (const [id, record] of this.refreshTokenStore) {
      if (record.userId === userId) {
        record.isRevoked = true;
      }
    }
  }
  
  async rotateRefreshToken(
    oldTokenId: string,
    newTokenId: string,
    newTokenHash: string
  ): Promise<boolean> {
    const oldRecord = this.refreshTokenStore.get(oldTokenId);
    
    if (!oldRecord || oldRecord.isRevoked || oldRecord.expiresAt < new Date()) {
      // Token reuse detected! Revoke all tokens for this user
      if (oldRecord) {
        await this.revokeAllUserTokens(oldRecord.userId);
      }
      return false;
    }
    
    // Mark old token as used and replaced
    oldRecord.isRevoked = true;
    oldRecord.replacedByTokenId = newTokenId;
    
    // Store new token
    await this.storeRefreshToken(
      oldRecord.userId,
      newTokenId,
      newTokenHash,
      { userAgent: oldRecord.userAgent, ipAddress: oldRecord.ipAddress }
    );
    
    return true;
  }
  
  async cleanupExpiredTokens(): Promise<number> {
    const now = new Date();
    let count = 0;
    
    for (const [id, record] of this.refreshTokenStore) {
      if (record.expiresAt < now) {
        this.refreshTokenStore.delete(id);
        count++;
      }
    }
    
    return count;
  }
}

// Singleton instance
export const tokenRotationService = new TokenRotationService();

// ============================================
// HASH UTILITY
// ============================================

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================
// COOKIE CONFIGURATION
// ============================================

export const cookieConfig = {
  accessToken: {
    name: 'access_token',
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 15 * 60, // 15 minutes
    },
  },
  refreshToken: {
    name: 'refresh_token',
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/api/auth', // Only sent to auth endpoints
      maxAge: 7 * 24 * 60 * 60, // 7 days
    },
  },
};
