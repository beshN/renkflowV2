// ============================================
// AUTH REFRESH TOKEN API ROUTE
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { 
  verifyRefreshToken,
  generateTokenPair,
  hashToken,
  tokenRotationService,
  cookieConfig,
} from '@/lib/auth/jwt';

// ============================================
// MOCK USER LOOKUP
// ============================================

async function findUserById(id: string) {
  const users: Record<string, { id: string; email: string; name: string; role: 'admin' | 'user' }> = {
    'user-1': { id: 'user-1', email: 'admin@example.com', name: 'Admin User', role: 'admin' },
    'user-2': { id: 'user-2', email: 'user@example.com', name: 'Regular User', role: 'user' },
  };
  return users[id] ?? null;
}

// ============================================
// POST /api/auth/refresh
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Get refresh token from cookie
    const refreshToken = request.cookies.get(cookieConfig.refreshToken.name)?.value;
    
    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token bulunamadı', code: 'NO_REFRESH_TOKEN' },
        { status: 401 }
      );
    }

    // Verify refresh token
    const payload = await verifyRefreshToken(refreshToken);
    
    if (!payload?.jti) {
      return NextResponse.json(
        { error: 'Geçersiz refresh token', code: 'INVALID_REFRESH_TOKEN' },
        { status: 401 }
      );
    }

    // Check token in store
    const storedToken = await tokenRotationService.getRefreshToken(payload.jti);
    const tokenHash = await hashToken(refreshToken);

    if (!storedToken || storedToken.isRevoked || storedToken.tokenHash !== tokenHash) {
      // Possible token reuse attack - revoke all user tokens
      if (storedToken) {
        await tokenRotationService.revokeAllUserTokens(storedToken.userId);
      }
      
      // Clear cookies
      const response = NextResponse.json(
        { error: 'Token geçersiz veya kullanılmış', code: 'TOKEN_REUSE_DETECTED' },
        { status: 401 }
      );
      response.cookies.delete(cookieConfig.accessToken.name);
      response.cookies.delete(cookieConfig.refreshToken.name);
      return response;
    }

    // Get user
    const user = await findUserById(payload.userId);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı', code: 'USER_NOT_FOUND' },
        { status: 401 }
      );
    }

    // Generate new token pair (rotation)
    const newTokens = await generateTokenPair(user);
    const newPayload = await verifyRefreshToken(newTokens.refreshToken);

    if (!newPayload?.jti) {
      return NextResponse.json(
        { error: 'Token oluşturulamadı', code: 'TOKEN_GENERATION_FAILED' },
        { status: 500 }
      );
    }

    // Rotate refresh token
    const newTokenHash = await hashToken(newTokens.refreshToken);
    const rotated = await tokenRotationService.rotateRefreshToken(
      payload.jti,
      newPayload.jti,
      newTokenHash
    );

    if (!rotated) {
      return NextResponse.json(
        { error: 'Token döndürme başarısız', code: 'ROTATION_FAILED' },
        { status: 401 }
      );
    }

    // Create response with new tokens
    const response = NextResponse.json({
      message: 'Token yenilendi',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    response.cookies.set(
      cookieConfig.accessToken.name,
      newTokens.accessToken,
      cookieConfig.accessToken.options
    );

    response.cookies.set(
      cookieConfig.refreshToken.name,
      newTokens.refreshToken,
      cookieConfig.refreshToken.options
    );

    return response;
  } catch (error) {
    console.error('Refresh error:', error);
    return NextResponse.json(
      { error: 'Sunucu hatası', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
