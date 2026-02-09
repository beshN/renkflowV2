import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.tenantId || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const membershipResult = await sql`
      SELECT role
      FROM tenant_members
      WHERE tenant_id = ${session.user.tenantId}
        AND user_id = ${session.user.id}
      LIMIT 1
    `;
    const membershipRows = membershipResult as Array<{ role: string }>;
    if (membershipRows.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['owner', 'admin'].includes(membershipRows[0].role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const invites = await sql`
      SELECT id, email, role, token, created_at, expires_at
      FROM invitations
      WHERE tenant_id = ${session.user.tenantId}
      ORDER BY created_at DESC
    `;

    const invitesRows = invites as any[];
    return NextResponse.json({
      success: true,
      invites: invitesRows.map((row: any) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        token: row.token,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      })),
    });
  } catch (error) {
    console.error('Invites fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
