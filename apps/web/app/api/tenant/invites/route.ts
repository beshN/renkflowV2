import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { z } from 'zod';

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  includeExpired: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
});

export async function GET(request: NextRequest) {
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

    const parsed = QuerySchema.safeParse({
      page: request.nextUrl.searchParams.get('page') || '1',
      pageSize: request.nextUrl.searchParams.get('pageSize') || '25',
      includeExpired: request.nextUrl.searchParams.get('includeExpired') || 'true',
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query params' }, { status: 400 });
    }

    const { page, pageSize, includeExpired } = parsed.data;
    const offset = (page - 1) * pageSize;

    const countResult = includeExpired
      ? await sql`
          SELECT COUNT(*)::int AS total
          FROM invitations
          WHERE tenant_id = ${session.user.tenantId}
        `
      : await sql`
          SELECT COUNT(*)::int AS total
          FROM invitations
          WHERE tenant_id = ${session.user.tenantId}
            AND expires_at > NOW()
        `;
    const total = Number((countResult as Array<{ total: number }>)[0]?.total || 0);

    const invites = includeExpired
      ? await sql`
          SELECT id, email, role, created_at, expires_at
          FROM invitations
          WHERE tenant_id = ${session.user.tenantId}
          ORDER BY created_at DESC
          LIMIT ${pageSize}
          OFFSET ${offset}
        `
      : await sql`
          SELECT id, email, role, created_at, expires_at
          FROM invitations
          WHERE tenant_id = ${session.user.tenantId}
            AND expires_at > NOW()
          ORDER BY created_at DESC
          LIMIT ${pageSize}
          OFFSET ${offset}
        `;

    const invitesRows = invites as any[];
    return NextResponse.json({
      success: true,
      invites: invitesRows.map((row: any) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Invites fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
