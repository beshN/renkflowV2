export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

import { sql } from '@/lib/db';

// Password strength validation
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Şifre gereklidir' };
  }
  
  if (password.length < 6) {
    return { valid: false, error: 'Şifre en az 6 karakter olmalıdır' };
  }
  
  if (password.length > 128) {
    return { valid: false, error: 'Şifre çok uzun' };
  }
  
  // Check for common weak passwords
  const weakPasswords = ['123456', 'password', '123456789', 'qwerty', 'abc123', '111111'];
  if (weakPasswords.includes(password.toLowerCase())) {
    return { valid: false, error: 'Bu şifre çok zayıf. Lütfen daha güçlü bir şifre seçin.' };
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
    const users = await sql`
      SELECT id, email, name FROM users
      WHERE password_reset_token = ${token}
      AND password_reset_expires > NOW()
      LIMIT 1
    `;

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'token_expired' },
        { status: 400 }
      );
    }

    const user = users[0];

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
      AND password_reset_token = ${token}
    `;

    // Log successful password reset (for security auditing)

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

