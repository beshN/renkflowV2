import { NextRequest, NextResponse } from 'next/server';

import { sql } from '@/lib/db';
import { consumeRateLimit, getClientIp, rateLimitResponse } from '@/lib/security/rate-limit';
import { PASSWORD_POLICY } from '@/lib/security/access-matrix';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token')?.trim();

  if (!token) {
    return NextResponse.json({ valid: false, error: 'Token gereklidir' });
  }
  const limit = await consumeRateLimit('inviteToken', getClientIp(request.headers));
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    // Check invitation validity
    const invitations = await sql`
      SELECT 
        i.id,
        i.tenant_id,
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

    const invitationsRows = invitations as any[];
    if (invitationsRows.length === 0) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Bu davet linki geçersiz veya süresi dolmuş.' 
      });
    }

    const invitation = invitationsRows[0];

    // Existing accounts can still accept invite if they are not yet a member.
    const existingUsers = await sql`
      SELECT id FROM users WHERE email = ${invitation.email} LIMIT 1
    `;

    const existingUsersRows = existingUsers as Array<{ id: string }>;
    const existingUserId = existingUsersRows[0]?.id;
    if (existingUserId) {
      const memberships = await sql`
        SELECT id
        FROM tenant_members
        WHERE tenant_id = ${invitation.tenant_id}
          AND user_id = ${existingUserId}
        LIMIT 1
      `;
      const membershipRows = memberships as Array<{ id: string }>;
      if (membershipRows.length > 0) {
        return NextResponse.json({
          valid: false,
          error: 'Bu kullanıcı zaten bu tenant ekibinde.',
        });
      }
    }

    return NextResponse.json({
      valid: true,
      email: invitation.email,
      role: invitation.role,
      tenantName: invitation.tenant_name,
      inviterName: invitation.inviter_name,
      existingUser: Boolean(existingUserId),
      passwordPolicy: PASSWORD_POLICY,
    });
  } catch (error: unknown) {
    console.error('Invitation validation error:', error);
    return NextResponse.json({ 
      valid: false, 
      error: 'Davet doğrulanırken bir hata oluştu.' 
    });
  }
}
