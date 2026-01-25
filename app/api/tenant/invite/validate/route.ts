import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token')?.trim();

  if (!token) {
    return NextResponse.json({ valid: false, error: 'Token gereklidir' });
  }

  try {
    // Check invitation validity
    const invitations = await sql`
      SELECT 
        i.id,
        i.email,
        i.role,
        i.expires_at,
        t.name as tenant_name,
        u.name as inviter_name
      FROM invitations i
      JOIN tenants t ON i.tenant_id = t.id
      LEFT JOIN tenant_members tm ON tm.tenant_id = i.tenant_id AND tm.role = 'owner'
      LEFT JOIN users u ON u.id = tm.user_id
      WHERE i.token = ${token}
      AND i.expires_at > NOW()
      LIMIT 1
    `;

    if (invitations.length === 0) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Bu davet linki geçersiz veya süresi dolmuş.' 
      });
    }

    const invitation = invitations[0];

    // Check if user already exists with this email
    const existingUsers = await sql`
      SELECT id FROM users WHERE email = ${invitation.email} LIMIT 1
    `;

    if (existingUsers.length > 0) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Bu e-posta adresi zaten kayıtlı. Lütfen giriş yapın.' 
      });
    }

    return NextResponse.json({
      valid: true,
      email: invitation.email,
      role: invitation.role,
      tenantName: invitation.tenant_name,
      inviterName: invitation.inviter_name,
    });
  } catch (error: unknown) {
    console.error('Invitation validation error:', error);
    return NextResponse.json({ 
      valid: false, 
      error: 'Davet doğrulanırken bir hata oluştu.' 
    });
  }
}
