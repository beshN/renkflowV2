import { NextRequest, NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import { sendInviteEmail } from '@/lib/email';
import { resolveServerBaseUrl } from '@/lib/shared/config/runtime-env';
import { AuthenticationError, AuthorizationError, assertTenantAccess, requireTenantContext } from '@/lib/auth/serverAuth';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Valid roles for invitation
const VALID_ROLES = ['admin', 'accountant', 'office', 'worker', 'member'];

// Generate cryptographically secure token using Web Crypto API (Edge compatible)
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  globalThis.crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

class InviteError extends Error {
  status: number;

  constructor(message: string, status: number = 400) {
    super(message);
    this.name = 'InviteError';
    this.status = status;
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireTenantContext();

    const body = await request.json();
    const requestedTenantId = body?.tenantId;
    const tenantId = context.tenantId;
    const email = body?.email?.trim().toLowerCase();
    const role = body?.role || 'member';

    // Validate inputs
    if (requestedTenantId) {
      assertTenantAccess(context, requestedTenantId);
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

    const token = await withTransaction(async (tx) => {
      const members = await tx`
        SELECT role FROM tenant_members
        WHERE tenant_id = ${tenantId} AND user_id = ${context.userId}
        LIMIT 1
        FOR UPDATE
      `;
      const membersRows = members as Array<{ role: string }>;

      if (membersRows.length === 0 || !['owner', 'admin'].includes(membersRows[0].role)) {
        throw new InviteError('Bu işlem için yetkiniz yok', 403);
      }

      const existingUsers = await tx`
        SELECT id FROM users WHERE email = ${email} LIMIT 1
      `;
      const existingUsersRows = existingUsers as Array<{ id: string }>;
      const existingUserId = existingUsersRows[0]?.id;

      if (existingUserId) {
        const existingMember = await tx`
          SELECT id FROM tenant_members
          WHERE tenant_id = ${tenantId} AND user_id = ${existingUserId}
          LIMIT 1
        `;
        const existingMemberRows = existingMember as Array<{ id: string }>;
        if (existingMemberRows.length > 0) {
          throw new InviteError('Bu kullanıcı zaten ekipte', 400);
        }
      }

      const invitationToken = generateSecureToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invitations = await tx`
        INSERT INTO invitations (tenant_id, email, token, role, expires_at, created_at)
        VALUES (${tenantId}, ${email}, ${invitationToken}, ${role}, ${expiresAt.toISOString()}, NOW())
        ON CONFLICT (tenant_id, email)
        DO UPDATE SET
          token = EXCLUDED.token,
          role = EXCLUDED.role,
          expires_at = EXCLUDED.expires_at,
          created_at = NOW()
        RETURNING token
      `;
      const invitationRows = invitations as Array<{ token: string }>;
      if (invitationRows.length === 0) {
        throw new Error('Invitation could not be created');
      }

      return invitationRows[0].token;
    });

    const baseUrl =
      resolveServerBaseUrl({
        context: 'api.tenant.invite',
        fallbackOrigin: request.nextUrl.origin,
      }) || request.nextUrl.origin;
    const inviteLink = `${baseUrl}/auth/accept-invite?token=${token}`;

    // Send the email
    const emailResult = await sendInviteEmail(email, inviteLink, role);

    // Log
    console.log(`Invitation created for ${email} with role ${role}`);

    return NextResponse.json({ 
      success: true, 
      inviteLink,
      emailSent: emailResult.success,
      message: emailResult.success ? 'Davet bağlantısı oluşturuldu ve e-posta gönderildi' : 'Davet bağlantısı oluşturuldu; e-posta teslimi yapılamadı. Bağlantıyı paylaşabilirsiniz.'
    });
  } catch (error: unknown) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof InviteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Invite error:', error);
    return NextResponse.json({ error: 'Davet oluşturulurken bir hata oluştu' }, { status: 500 });
  }
}
