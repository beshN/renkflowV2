import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(
      new URL('/auth/login?error=invalid_token', request.url)
    );
  }

  try {
    // Verify token and update user
    const users = await sql`
      UPDATE users
      SET email_verified = NOW(), verification_token = NULL
      WHERE verification_token = ${token}
      RETURNING id, email, name
    `;

    if (users.length === 0) {
      return NextResponse.redirect(
        new URL('/auth/login?error=invalid_token', request.url)
      );
    }

    // Success - redirect to login with success message
    return NextResponse.redirect(
      new URL('/auth/login?verified=true', request.url)
    );
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.redirect(
      new URL('/auth/login?error=verification_failed', request.url)
    );
  }
}
