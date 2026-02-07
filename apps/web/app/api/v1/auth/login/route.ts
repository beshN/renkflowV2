import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { successResponse, errorResponse, handleCORS, generateAPIToken } from '@/lib/api/auth-helpers';
import { authRateLimiter, createRateLimitResponse } from '@/lib/rateLimiter';
import { sessionManager } from '@/lib/redis';

import { sql } from '@/lib/db';

// Email validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// CORS preflight
export async function OPTIONS() {
  return handleCORS();
}

// POST /api/v1/auth/login - Login and get JWT token
export async function POST(request: NextRequest) {
  // Check rate limit with Redis-backed limiter
  const rateLimitResult = await authRateLimiter.check(request, 'login');
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult);
  }

  try {
    const body = await request.json();
    const email = body?.email?.trim()?.toLowerCase();
    const password = body?.password;

    // Validate inputs
    if (!email || !password) {
      return errorResponse('E-posta ve şifre gereklidir', 400);
    }

    if (!EMAIL_REGEX.test(email)) {
      return errorResponse('Geçerli bir e-posta adresi girin', 400);
    }

    // Find user
    const users = await sql`
      SELECT 
        u.id, 
        u.email, 
        u.name, 
        u.password,
        u.email_verified,
        tm.role,
        tm.tenant_id
      FROM users u
      LEFT JOIN tenant_members tm ON tm.user_id = u.id
      WHERE u.email = ${email}
      LIMIT 1
    `;

    const usersRows = users as any[];
    if (usersRows.length === 0) {
      // Record failed attempt for rate limiting
      await authRateLimiter.recordFailure(request, 'login');
      return errorResponse('E-posta veya şifre hatalı', 401);
    }

    const user = usersRows[0];

    // Check if email is verified
    if (!user.email_verified) {
      return errorResponse('Lütfen önce e-posta adresinizi doğrulayın', 401);
    }

    // Verify password
    if (!user.password) {
      return errorResponse('Bu hesap için şifre ile giriş yapılamaz', 401);
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      // Record failed attempt for rate limiting
      await authRateLimiter.recordFailure(request, 'login');
      return errorResponse('E-posta veya şifre hatalı', 401);
    }

    // Clear rate limit on successful login
    await authRateLimiter.clearLimit(request, 'login');

    // Generate JWT token
    const { accessToken, expiresIn } = generateAPIToken({
      id: user.id,
      email: user.email,
      name: user.name || 'Kullanıcı',
      role: user.role || 'member',
      tenantId: user.tenant_id || '',
    });

    // Create session in Redis
    const sessionId = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown';

    await sessionManager.createSession(sessionId, {
      userId: user.id,
      email: user.email,
      tenantId: user.tenant_id,
      userAgent,
      ip,
    });

    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'member',
        tenantId: user.tenant_id,
      },
      accessToken,
      expiresIn,
      tokenType: 'Bearer',
      sessionId,
    }, 'Giriş başarılı');
  } catch (error: unknown) {
    console.error('API login error:', error);
    return errorResponse('Giriş yapılırken bir hata oluştu', 500);
  }
}
