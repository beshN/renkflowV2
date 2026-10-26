import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hashResetToken } from '@/lib/features/auth/reset-token';
import { consumeRateLimit, getClientIp, rateLimitResponse } from '@/lib/security/rate-limit';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ valid: false });
  }
  const limit = await consumeRateLimit('resetTokenCheck', getClientIp(request.headers));
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const tokenHash = await hashResetToken(token);
    const users = await sql`
      SELECT id FROM users
      WHERE password_reset_token = ${tokenHash}
      AND password_reset_expires > NOW()
      LIMIT 1
    `;

    return NextResponse.json({ valid: (users as any[]).length > 0 });
  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json({ valid: false });
  }
}
