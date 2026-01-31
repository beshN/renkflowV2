import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { sendInviteEmail } from '@/lib/email';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Valid roles for invitation
const VALID_ROLES = ['admin', 'office', 'worker', 'member'];

// Generate cryptographically secure token using Web Crypto API (Edge compatible)
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  globalThis.crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 });
    }

    const body = await request.json();
    const tenantId = body?.tenantId;
    const email = body?.email?.trim().toLowerCase();
    const role = body?.role || 'member';

    // Validate inputs
    if (!tenantId) {
      return NextResponse.json({ error: 'Şirket kimliği gereklidir' }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: 'E-posta adresi gereklidir' }, { status: 400 });
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Geçerli bir e-posta adresi girin' }, { status: 400 });
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Geçersiz rol' }, { status: 400 });
    }

    // Verify user has permission to invite
    const members = await sql`
      SELECT role FROM tenant_members
      WHERE tenant_id = ${tenantId} AND user_id = ${session.user.id}
      LIMIT 1
    `;

    if (members.length === 0 || !['owner', 'admin'].includes(members[0].role)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 });
    }

    // Check if user already exists
    const existingUsers = await sql`
      SELECT id FROM users WHERE email = ${email} LIMIT 1
    `;

    if (existingUsers.length > 0) {
      // Check if already a member of this tenant
      const existingMember = await sql`
        SELECT id FROM tenant_members 
        WHERE tenant_id = ${tenantId} AND user_id = ${existingUsers[0].id}
        LIMIT 1
      `;

      if (existingMember.length > 0) {
        return NextResponse.json({ error: 'Bu kullanıcı zaten ekipte' }, { status: 400 });
      }
    }

    // Check for existing pending invitation
    const existingInvite = await sql`
      SELECT id FROM invitations 
      WHERE tenant_id = ${tenantId} AND email = ${email} AND expires_at > NOW()
      LIMIT 1
    `;

    if (existingInvite.length > 0) {
      return NextResponse.json({ error: 'Bu e-posta için zaten bekleyen bir davet var' }, { status: 400 });
    }

    // Create invitation with secure token
    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await sql`
      INSERT INTO invitations (tenant_id, email, token, role, expires_at, created_at)
      VALUES (${tenantId}, ${email}, ${token}, ${role}, ${expiresAt.toISOString()}, NOW())
    `;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteLink = `${baseUrl}/auth/accept-invite?token=${token}`;

    // Send the email
    await sendInviteEmail(email, inviteLink, role);

    // Log
    console.log(`Invitation created for ${email} with role ${role}`);

    return NextResponse.json({ 
      success: true, 
      inviteLink,
      message: 'Davet linki oluşturuldu ve e-posta gönderildi'
    });
  } catch (error: unknown) {
    console.error('Invite error:', error);
    return NextResponse.json({ error: 'Davet oluşturulurken bir hata oluştu' }, { status: 500 });
  }
}

