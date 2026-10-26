import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sendVerificationEmail } from '@/lib/email';
import { consumeRateLimit, getClientIp, rateLimitResponse } from '@/lib/security/rate-limit';
import { resolveServerBaseUrl } from '@/lib/shared/config/runtime-env';
import { isSsoTicketValue } from '@/lib/features/auth/sso-ticket';

/**
 * Resend Verification Email
 * POST /api/auth/resend-verification
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  const limit = await consumeRateLimit('verificationEmail', getClientIp(request.headers));
  if (!limit.allowed) {
    return rateLimitResponse(limit);
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
    // Unknown, already verified and throttled addresses get the same answer so the
    // endpoint cannot be used to discover which emails have accounts.
    const genericResponse = {
      success: true,
      message: 'Eğer bu e-posta adresi kayıtlıysa, doğrulama linki gönderilecektir.',
    };
    if (usersRows.length === 0 || usersRows[0].email_verified) {
      return NextResponse.json(genericResponse);
    }

    const user = usersRows[0];

    const accountLimit = await consumeRateLimit('verificationEmail', `account:${email}`);
    if (!accountLimit.allowed) {
      return NextResponse.json(genericResponse);
    }

    // Generate new token if needed
    // An `sso:` value is a login ticket parked in the same column, never something to mail out.
    let token = isSsoTicketValue(user.verification_token) ? null : user.verification_token;
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
    const baseUrl =
      resolveServerBaseUrl({
        context: 'api.auth.resend-verification',
        fallbackOrigin: request.nextUrl.origin,
      }) || request.nextUrl.origin;
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
  } catch (error: unknown) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { error: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.', field: 'general' },
      { status: 500 }
    );
  }
}
