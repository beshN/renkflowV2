import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ valid: false });
  }

  try {
    const users = await sql`
      SELECT id FROM users
      WHERE password_reset_token = ${token}
      AND password_reset_expires > NOW()
      LIMIT 1
    `;

    return NextResponse.json({ valid: users.length > 0 });
  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json({ valid: false });
  }
}
