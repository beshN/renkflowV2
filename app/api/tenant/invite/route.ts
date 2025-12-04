import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { auth } from '@/auth';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId, email, role } = await request.json();

    // Verify user has permission
    const members = await sql`
      SELECT role FROM tenant_members
      WHERE tenant_id = ${tenantId} AND user_id = ${session.user.id}
      LIMIT 1
    `;

    if (members.length === 0 || !['owner', 'admin'].includes(members[0].role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Create invitation
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    try {
      await sql`
        INSERT INTO invitations (tenant_id, email, token, role, expires_at)
        VALUES (${tenantId}, ${email}, ${token}, ${role}, ${expiresAt.toISOString()})
      `;
    } catch (err: any) {
      if (err.code === '23505') {
        return NextResponse.json({ error: 'Bu e-posta için zaten davet var' }, { status: 400 });
      }
      throw err;
    }

    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/accept-invite?token=${token}`;

    return NextResponse.json({ success: true, inviteLink });
  } catch (error: any) {
    console.error('Invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
