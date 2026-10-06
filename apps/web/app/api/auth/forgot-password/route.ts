import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { consumeRateLimit, getClientIp, rateLimitResponse } from '@/lib/security/rate-limit';
import { resolveServerBaseUrl } from '@/lib/shared/config/runtime-env';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

import { sendPasswordResetEmail } from '@/lib/email';

// Generate cryptographically secure token using Web Crypto API (Edge compatible)
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  globalThis.crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: NextRequest) {
  const limit = await consumeRateLimit('passwordReset', getClientIp(request.headers));
  if (!limit.allowed) {
    return rateLimitResponse(limit);
  }

  try {
    const body = await request.json();
    const email = body?.email?.trim().toLowerCase();

    // Validate email format
    if (!email) {
      return NextResponse.json(
        { error: 'E-posta adresi gereklidir' },
        { status: 400 }
      );
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: 'Geçerli bir e-posta adresi girin' },
        { status: 400 }
      );
    }

    // Check if user exists
    const users = await sql`
      SELECT id, name, email, password_reset_expires 
      FROM users 
      WHERE email = ${email} 
      LIMIT 1
    `;

    // Security: Always return success to prevent email enumeration
    const successResponse = { 
      success: true,
      message: 'Eğer bu e-posta adresi kayıtlıysa, şifre sıfırlama linki gönderilecektir.'
    };

    const usersRows = users as any[];
    if (usersRows.length === 0) {
      // Wait a bit to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 100));
      return NextResponse.json(successResponse);
    }

    const user = usersRows[0];

    // Rate limiting: Check if a recent reset request was made (within 2 minutes)
    if (user.password_reset_expires) {
      const expiresAt = new Date(user.password_reset_expires);
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const tokenCreatedAt = new Date(expiresAt.getTime() - 60 * 60 * 1000); // Token valid for 1 hour
      
      if (tokenCreatedAt > twoMinutesAgo) {
        // Recent request exists, but don't reveal this
        return NextResponse.json(successResponse);
      }
    }

    // Generate secure reset token
    const resetToken = generateSecureToken();
    const resetTokenHash = await hashToken(resetToken);
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Save token to database
    await sql`
      UPDATE users
      SET 
        password_reset_token = ${resetTokenHash}, 
        password_reset_expires = ${resetExpires.toISOString()},
        updated_at = NOW()
      WHERE id = ${user.id}
    `;

    // Generate reset URL
    const baseUrl =
      resolveServerBaseUrl({
        context: 'api.auth.forgot-password',
        fallbackOrigin: request.nextUrl.origin,
      }) || request.nextUrl.origin;
    const resetUrl = `${baseUrl}/auth/update-password?token=${resetToken}`;

    // Send password reset email
    const emailResult = await sendPasswordResetEmail(
      email, 
      user.name || 'Kullanıcı', 
      resetUrl
    );

    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error);
      // Still return success for security
    }

    return NextResponse.json(successResponse);
  } catch (error: unknown) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Bir hata oluştu. Lütfen tekrar deneyin.' },
      { status: 500 }
    );
  }
}
