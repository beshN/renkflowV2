// ============================================
// AUTH LOGOUT API ROUTE
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { 
  verifyRefreshToken,
  tokenRotationService,
  cookieConfig,
} from '@/lib/auth/jwt';

// ============================================
// POST /api/auth/logout
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Get refresh token
    const refreshToken = request.cookies.get(cookieConfig.refreshToken.name)?.value;
    
    // Revoke token if exists
    if (refreshToken) {
      const payload = await verifyRefreshToken(refreshToken);
      
      if (payload?.jti) {
        await tokenRotationService.revokeRefreshToken(payload.jti);
      }
    }

    // Create response
    const response = NextResponse.json({
      message: 'Çıkış başarılı',
    });

    // Clear cookies
    response.cookies.delete(cookieConfig.accessToken.name);
    response.cookies.delete(cookieConfig.refreshToken.name);

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    
    // Still clear cookies on error
    const response = NextResponse.json({
      message: 'Çıkış yapıldı',
    });
    response.cookies.delete(cookieConfig.accessToken.name);
    response.cookies.delete(cookieConfig.refreshToken.name);
    
    return response;
  }
}

// ============================================
// DELETE /api/auth/logout - Logout all sessions
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get(cookieConfig.refreshToken.name)?.value;
    
    if (refreshToken) {
      const payload = await verifyRefreshToken(refreshToken);
      
      if (payload?.userId) {
        await tokenRotationService.revokeAllUserTokens(payload.userId);
      }
    }

    const response = NextResponse.json({
      message: 'Tüm oturumlar sonlandırıldı',
    });

    response.cookies.delete(cookieConfig.accessToken.name);
    response.cookies.delete(cookieConfig.refreshToken.name);

    return response;
  } catch (error) {
    console.error('Logout all error:', error);
    return NextResponse.json(
      { error: 'Sunucu hatası', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
