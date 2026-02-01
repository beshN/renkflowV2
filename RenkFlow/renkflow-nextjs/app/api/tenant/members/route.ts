import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.tenantId || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const members = await sql`
      SELECT 
        tm.id as membership_id,
        tm.role,
        tm.created_at,
        u.id as user_id,
        u.name,
        u.email,
        u.image
      FROM tenant_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.tenant_id = ${session.user.tenantId}
      ORDER BY tm.created_at DESC
    `;

    return NextResponse.json({
      success: true,
      members: members.map((row: any) => ({
        id: row.user_id,
        name: row.name,
        email: row.email,
        role: row.role,
        avatar: row.image,
        joinedAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error('Members fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
