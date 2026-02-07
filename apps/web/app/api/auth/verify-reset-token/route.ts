import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ valid: false });
  }

  try {
    const tokenHash = await hashToken(token);
    const users = await sql`
      SELECT id, password_reset_token FROM users
      WHERE (password_reset_token = ${tokenHash} OR password_reset_token = ${token})
      AND password_reset_expires > NOW()
      LIMIT 1
    `;

    const usersRows = users as any[];
    if (usersRows.length > 0 && usersRows[0].password_reset_token === token) {
      await sql`
        UPDATE users
        SET password_reset_token = ${tokenHash}, updated_at = NOW()
        WHERE id = ${usersRows[0].id}
        AND password_reset_token = ${token}
      `;
    }

    return NextResponse.json({ valid: usersRows.length > 0 });
  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json({ valid: false });
  }
}
