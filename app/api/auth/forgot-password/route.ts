import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { sendPasswordResetEmail } from '@/lib/email';
import crypto from 'crypto';

import { sql } from '@/lib/db';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Generate cryptographically secure token
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function POST(request: Request) {
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

    if (users.length === 0) {
      // Wait a bit to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 100));
      return NextResponse.json(successResponse);
    }

    const user = users[0];

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
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Save token to database
    await sql`
      UPDATE users
      SET 
        password_reset_token = ${resetToken}, 
        password_reset_expires = ${resetExpires.toISOString()},
        updated_at = NOW()
      WHERE id = ${user.id}
    `;

    // Generate reset URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
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

export const runtime = 'edge';
