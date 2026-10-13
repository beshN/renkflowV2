import { NextResponse } from 'next/server';
import { passwordProblem } from '@/lib/security/access-matrix';
import bcrypt from 'bcryptjs';

import { sql } from '@/lib/db';
import { columnExists } from '@/lib/db/schema-guard';
import { hashResetToken } from '@/lib/features/auth/reset-token';

// Password strength validation
function validatePassword(password: unknown, email?: string | null): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Şifre gereklidir' };
  }
  const problem = passwordProblem(password, email);
  if (problem) return { valid: false, error: problem };
  const weakPasswords = ['password123', 'qwerty12345', '1234567890a', 'abc1234567'];
  if (weakPasswords.includes(password.toLowerCase())) {
    return { valid: false, error: 'Bu şifre çok zayıf' };
  }
  return { valid: true };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = body?.token?.trim();
    const password = body?.password;

    // Validate inputs
    if (!token) {
      return NextResponse.json(
        { error: 'Geçersiz istek' },
        { status: 400 }
      );
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.error },
        { status: 400 }
      );
    }

    // Verify token and check expiration
    const tokenHash = await hashResetToken(token);
    const users = await sql`
      SELECT id, email, name FROM users
      WHERE password_reset_token = ${tokenHash}
      AND password_reset_expires > NOW()
      LIMIT 1
    `;

    const usersRows = users as any[];
    if (usersRows.length === 0) {
      return NextResponse.json(
        { error: 'token_expired' },
        { status: 400 }
      );
    }

    const user = usersRows[0];
    // The e-mail name check needs the account, so it runs after the token is found.
    const emailCheck = validatePassword(password, user.email);
    if (!emailCheck.valid) {
      return NextResponse.json({ error: emailCheck.error }, { status: 400 });
    }

    // Hash new password with strong salt rounds
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update password and clear reset token in a single transaction
    await sql`
      UPDATE users
      SET 
        password = ${hashedPassword},
        password_reset_token = NULL,
        password_reset_expires = NULL,
        updated_at = NOW()
      WHERE id = ${user.id}
      AND password_reset_token = ${tokenHash}
    `;

    // A new password closes every earlier sign-in (from migration 044 on).
    if (await columnExists('users', 'sessions_valid_after')) {
      try {
        await sql`UPDATE users SET sessions_valid_after = now() WHERE id = ${user.id}`;
        await sql`UPDATE user_sessions SET revoked_at = now() WHERE user_id = ${user.id} AND revoked_at IS NULL`;
      } catch (error) {
        console.error('[reset-password] sessions not closed', error instanceof Error ? error.message : error);
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Şifreniz başarıyla güncellendi.'
    });
  } catch (error: unknown) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Bir hata oluştu. Lütfen tekrar deneyin.' },
      { status: 500 }
    );
  }
}
