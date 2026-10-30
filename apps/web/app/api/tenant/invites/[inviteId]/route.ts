import { recordAuditAfterCommit } from '@/lib/audit/audit-log';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { z } from 'zod';
import { crossOriginRejection } from '@/lib/features/manufacturing/http-security';

const ParamsSchema = z.object({
  inviteId: z.string().uuid(),
});

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ inviteId: string }> }
) {
  const crossOrigin = crossOriginRejection(request);
  if (crossOrigin) return crossOrigin;
  try {
    const session = await auth();
    if (!session?.user?.tenantId || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const parsedParams = ParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: 'Invalid invite id' }, { status: 400 });
    }

    const membershipResult = await sql`
      SELECT role
      FROM tenant_members
      WHERE tenant_id = ${session.user.tenantId}
        AND user_id = ${session.user.id} AND (to_jsonb(tenant_members) ->> 'deactivated_at') IS NULL
      LIMIT 1
    `;
    const membershipRows = membershipResult as Array<{ role: string }>;
    if (membershipRows.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['owner', 'admin'].includes(membershipRows[0].role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const deleted = await sql`
      DELETE FROM invitations
      WHERE id = ${parsedParams.data.inviteId}
        AND tenant_id = ${session.user.tenantId}
      RETURNING id, email
    `;
    const deletedRows = deleted as Array<{ id: string; email: string }>;
    if (deletedRows.length === 0) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }
    await recordAuditAfterCommit({ tenantId: session.user.tenantId, actorId: session.user.id, entityType: 'tenant', entityId: session.user.tenantId, action: 'invite_revoked', metadata: { email: deletedRows[0].email } });

    return NextResponse.json({
      success: true,
      inviteId: deletedRows[0].id,
      email: deletedRows[0].email,
      message: 'Davet iptal edildi',
    });
  } catch (error) {
    console.error('Delete invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
