import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { z } from 'zod';
import { crossOriginRejection } from '@/lib/features/manufacturing/http-security';

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  search: z.string().trim().max(120).optional(),
});

const CreateTicketSchema = z.object({
  subject: z.string().trim().min(2).max(200),
  message: z.string().trim().min(10).max(5000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  pagePath: z.string().trim().max(512).optional(),
  locale: z.string().trim().max(12).optional(),
});

const ALLOWED_ROLES = new Set(['owner', 'admin', 'office']);

type SupportActor = {
  userId: string;
  tenantId: string;
  role: string;
  email: string | null;
  name: string | null;
};

async function resolveSupportActor(): Promise<SupportActor> {
  const session = await auth();
  if (!session?.user?.id || !session.user.tenantId) {
    throw new Error('UNAUTHORIZED');
  }

  const membershipResult = await sql`
    SELECT role
    FROM tenant_members
    WHERE tenant_id = ${session.user.tenantId}
      AND user_id = ${session.user.id}
    LIMIT 1
  `;
  const membershipRows = membershipResult as Array<{ role: string }>;
  const membership = membershipRows[0];
  if (!membership || !ALLOWED_ROLES.has(membership.role)) {
    throw new Error('FORBIDDEN');
  }

  return {
    userId: session.user.id,
    tenantId: session.user.tenantId,
    role: membership.role,
    email: session.user.email || null,
    name: session.user.name || null,
  };
}

function actorErrorToResponse(error: unknown): NextResponse | null {
  if (!(error instanceof Error)) return null;
  if (error.message === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (error.message === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveSupportActor();
    const parsed = QuerySchema.safeParse({
      page: request.nextUrl.searchParams.get('page') || '1',
      pageSize: request.nextUrl.searchParams.get('pageSize') || '20',
      status: request.nextUrl.searchParams.get('status') || undefined,
      priority: request.nextUrl.searchParams.get('priority') || undefined,
      search: request.nextUrl.searchParams.get('search') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query', details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const query = parsed.data;
    const whereParts: string[] = ['tenant_id = $1'];
    const params: unknown[] = [actor.tenantId];

    if (query.status) {
      params.push(query.status);
      whereParts.push(`status = $${params.length}`);
    }

    if (query.priority) {
      params.push(query.priority);
      whereParts.push(`priority = $${params.length}`);
    }

    if (query.search) {
      params.push(`%${query.search}%`);
      const idx = params.length;
      whereParts.push(`(name ILIKE $${idx} OR email ILIKE $${idx} OR subject ILIKE $${idx})`);
    }

    const whereClause = whereParts.join(' AND ');
    const offset = (query.page - 1) * query.pageSize;

    const totalRows = await sql.unsafe(
      `SELECT COUNT(*)::int as total FROM support_tickets WHERE ${whereClause}`,
      params
    );
    const total = Number((totalRows as Array<{ total: number }>)[0]?.total || 0);

    const listRows = await sql.unsafe(
      `
        SELECT
          id,
          source,
          status,
          priority,
          name,
          email,
          subject,
          message,
          page_path,
          locale,
          user_agent,
          metadata,
          created_at,
          updated_at
        FROM support_tickets
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
      `,
      [...params, query.pageSize, offset]
    );

    return NextResponse.json({
      success: true,
      data: listRows,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    });
  } catch (error) {
    const mapped = actorErrorToResponse(error);
    if (mapped) return mapped;

    console.error('Support tickets list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const crossOrigin = crossOriginRejection(request);
  if (crossOrigin) return crossOrigin;
  try {
    const actor = await resolveSupportActor();
    const body = await request.json();
    const parsed = CreateTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const row = await sql`
      INSERT INTO support_tickets (
        tenant_id,
        user_id,
        source,
        status,
        priority,
        name,
        email,
        subject,
        message,
        page_path,
        locale,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        ${actor.tenantId},
        ${actor.userId},
        'in_app',
        'open',
        ${parsed.data.priority},
        ${actor.name || 'Tenant Member'},
        ${actor.email || 'unknown@renkflow.local'},
        ${parsed.data.subject},
        ${parsed.data.message},
        ${parsed.data.pagePath || null},
        ${parsed.data.locale || null},
        ${{
          createdByRole: actor.role,
        }},
        NOW(),
        NOW()
      )
      RETURNING *
    `;

    return NextResponse.json({ success: true, data: row[0] }, { status: 201 });
  } catch (error) {
    const mapped = actorErrorToResponse(error);
    if (mapped) return mapped;

    console.error('Support ticket create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
