import { NextRequest } from 'next/server';
import { successResponse, errorResponse, handleCORS, generateAPIToken } from '@/lib/api/auth-helpers';
import { getClientIp, rateLimitResponse } from '@/lib/security/rate-limit';
import { clearLoginAttempts, consumeLoginAttempt, verifyPassword } from '@/lib/features/auth/login-guard';
import { isMfaEnabled } from '@/lib/features/auth/mfa.server';
import { isPrivateAccessAllowed } from '@/lib/features/auth/private-access';
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
  const ip = getClientIp(request.headers);

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

    const rateLimitResult = await consumeLoginAttempt(ip, email);
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult, 'Çok fazla giriş denemesi. Lütfen biraz bekleyip tekrar deneyin.');
    }

    if (!isPrivateAccessAllowed(email)) {
      return errorResponse('E-posta veya şifre hatalı', 401);
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
      LEFT JOIN LATERAL (
        SELECT tenant_id, role
        FROM tenant_members
        WHERE user_id = u.id
        ORDER BY
          CASE role
            WHEN 'owner' THEN 0
            WHEN 'admin' THEN 1
            WHEN 'accountant' THEN 2
            WHEN 'office' THEN 3
            WHEN 'worker' THEN 4
            ELSE 5
          END,
          created_at ASC
        LIMIT 1
      ) tm ON true
      WHERE u.email = ${email}
      LIMIT 1
    `;

    const user = (users as any[])[0];

    // Unknown accounts, OAuth-only accounts and wrong passwords are indistinguishable.
    const isValidPassword = await verifyPassword(String(password), user?.password);
    if (!user || !isValidPassword) {
      return errorResponse('E-posta veya şifre hatalı', 401);
    }

    // Only reveal verification state after the caller proved they own the password.
    if (!user.email_verified) {
      return errorResponse('Lütfen önce e-posta adresinizi doğrulayın', 401);
    }

    if (!user.tenant_id) {
      return errorResponse('Kullanıcının aktif tenant üyeliği bulunamadı', 403);
    }

    // This token is password-only: an account with two-step sign-in must sign in on the web (as the
    // field app does), or the second step could be skipped. Checked after the password, so the
    // answer reveals nothing to someone who does not know it.
    if (await isMfaEnabled(sql, user.id)) {
      return errorResponse('İki adımlı doğrulama açık hesaplar bu API ile giriş yapamaz. Web üzerinden giriş yapın.', 403);
    }

    await clearLoginAttempts(email);

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
