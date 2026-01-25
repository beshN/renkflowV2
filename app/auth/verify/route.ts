import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

import { sql } from '@/lib/db';

// Validate token format (should be 64 hex characters)
function isValidTokenFormat(token: string): boolean {
  return /^[a-f0-9]{64}$/i.test(token);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token')?.trim();

  // Validate token presence and format
  if (!token) {
    return NextResponse.redirect(
      new URL('/auth/login?error=invalid_token', request.url)
    );
  }

  // Check token format (basic security check)
  if (!isValidTokenFormat(token)) {
    console.warn('Invalid verification token format attempted');
    return NextResponse.redirect(
      new URL('/auth/login?error=invalid_token', request.url)
    );
  }

  try {
    // First check if token exists and is not already verified
    const existingUsers = await sql`
      SELECT id, email, email_verified FROM users
      WHERE verification_token = ${token}
      LIMIT 1
    `;

    if (existingUsers.length === 0) {
      return NextResponse.redirect(
        new URL('/auth/login?error=invalid_token', request.url)
      );
    }

    // Check if already verified
    if (existingUsers[0].email_verified) {
      // Already verified, redirect to login with success
      return NextResponse.redirect(
        new URL('/auth/login?verified=true', request.url)
      );
    }

    // Verify token and update user
    const users = await sql`
      UPDATE users
      SET 
        email_verified = NOW(), 
        verification_token = NULL,
        updated_at = NOW()
      WHERE verification_token = ${token}
      AND email_verified IS NULL
      RETURNING id, email, name
    `;

    if (users.length === 0) {
      return NextResponse.redirect(
        new URL('/auth/login?error=invalid_token', request.url)
      );
    }

    // Log successful verification
    // console.log(`Email verified for user: ${users[0].email}`);

    // Success - redirect to login with success message
    return NextResponse.redirect(
      new URL('/auth/login?verified=true', request.url)
    );
  } catch (error: unknown) {
    console.error('Verification error:', error);
    return NextResponse.redirect(
      new URL('/auth/login?error=verification_failed', request.url)
    );
  }
}

export const runtime = 'edge';
