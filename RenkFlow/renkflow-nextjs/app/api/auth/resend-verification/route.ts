import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sendVerificationEmail } from '@/lib/email';
import { authLimiter, rateLimitResponse } from '@/lib/api/rate-limit';

/**
 * Resend Verification Email
 * POST /api/auth/resend-verification
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  const { allowed, remaining, resetIn } = authLimiter.check(request);
  if (!allowed) {
    return rateLimitResponse(remaining, resetIn);
  }

  try {
    const body = await request.json();
    const email = body?.email?.trim()?.toLowerCase();

    if (!email) {
      return NextResponse.json(
        { error: 'E-posta adresi gereklidir', field: 'email' },
        { status: 400 }
      );
    }

    // Find user
    const users = await sql`
      SELECT id, name, email, email_verified, verification_token
      FROM users
      WHERE email = ${email}
      LIMIT 1
    `;

    const usersRows = users as any[];
    if (usersRows.length === 0) {
      // Don't reveal if email exists or not for security
      return NextResponse.json({
        success: true,
        message: 'Eğer bu e-posta adresi kayıtlıysa, doğrulama linki gönderilecektir.',
      });
    }

    const user = usersRows[0];

    // Check if already verified
    if (user.email_verified) {
      return NextResponse.json(
        { error: 'Bu e-posta adresi zaten doğrulanmış. Giriş yapabilirsiniz.', field: 'email' },
        { status: 400 }
      );
    }

    // Generate new token if needed
    let token = user.verification_token;
    if (!token) {
      const array = new Uint8Array(32);
      globalThis.crypto.getRandomValues(array);
      token = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');

      await sql`
        UPDATE users
        SET verification_token = ${token}, updated_at = NOW()
        WHERE id = ${user.id}
      `;
    }

    // Send verification email
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const verificationUrl = `${baseUrl}/auth/verify?token=${token}`;

    const emailResult = await sendVerificationEmail(user.email, user.name || 'Kullanıcı', verificationUrl);

    if (!emailResult.success) {
      console.error('Failed to resend verification email:', emailResult.error);
      return NextResponse.json(
        { error: 'E-posta gönderilemedi. Lütfen daha sonra tekrar deneyin.', field: 'general' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Doğrulama e-postası gönderildi. Lütfen gelen kutunuzu kontrol edin.',
    });
  } catch (error: any) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { error: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.', field: 'general' },
      { status: 500 }
    );
  }
}
