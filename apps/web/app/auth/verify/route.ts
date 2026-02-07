import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Validate token format (should be 64 hex characters)
function isValidTokenFormat(token: string): boolean {
  return /^[a-f0-9]{64}$/i.test(token);
}

function toRequestUrl(request: NextRequest, pathnameWithQuery: string): URL {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost || request.headers.get('host');

  if (host) {
    const isLocalHost =
      host.startsWith('localhost') ||
      host.startsWith('127.0.0.1') ||
      host.startsWith('0.0.0.0');
    const proto = isLocalHost ? 'http' : (forwardedProto || 'https');
    return new URL(pathnameWithQuery, `${proto}://${host}`);
  }

  return new URL(pathnameWithQuery, request.url);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token')?.trim();

  // Validate token presence and format
  if (!token) {
    return NextResponse.redirect(
      toRequestUrl(request, '/auth/login?error=invalid_token')
    );
  }

  // Check token format (basic security check)
  if (!isValidTokenFormat(token)) {
    console.warn('Invalid verification token format attempted');
    return NextResponse.redirect(
      toRequestUrl(request, '/auth/login?error=invalid_token')
    );
  }

  try {
    // First check if token exists and is not already verified
    const existingUsers = await sql`
      SELECT id, email, email_verified FROM users
      WHERE verification_token = ${token}
      LIMIT 1
    `;

    const existingUsersRows = existingUsers as any[];
    if (existingUsersRows.length === 0) {
      return NextResponse.redirect(
        toRequestUrl(request, '/auth/login?error=invalid_token')
      );
    }

    // Check if already verified
    if (existingUsersRows[0].email_verified) {
      // Already verified, redirect to login with success
      return NextResponse.redirect(
        toRequestUrl(request, '/auth/login?verified=true')
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

    const usersRows = users as any[];
    if (usersRows.length === 0) {
      return NextResponse.redirect(
        toRequestUrl(request, '/auth/login?error=invalid_token')
      );
    }

    // Log successful verification
    // console.log(`Email verified for user: ${users[0].email}`);

    // Success - redirect to login with success message
    return NextResponse.redirect(
      toRequestUrl(request, '/auth/login?verified=true')
    );
  } catch (error: unknown) {
    console.error('Verification error:', error);
    return NextResponse.redirect(
      toRequestUrl(request, '/auth/login?error=verification_failed')
    );
  }
}
