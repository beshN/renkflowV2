import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { z } from 'zod';

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().trim().min(1).max(64).optional(),
  entityType: z.string().trim().min(1).max(64).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

function parseDateOrNull(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = QuerySchema.safeParse({
      page: request.nextUrl.searchParams.get('page') || '1',
      pageSize: request.nextUrl.searchParams.get('pageSize') || '20',
      action: request.nextUrl.searchParams.get('action') || undefined,
      entityType: request.nextUrl.searchParams.get('entityType') || undefined,
      from: request.nextUrl.searchParams.get('from') || undefined,
      to: request.nextUrl.searchParams.get('to') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query params' }, { status: 400 });
    }

    const query = parsed.data;
    const fromDate = parseDateOrNull(query.from);
    const toDate = parseDateOrNull(query.to);
    if (query.from && !fromDate) {
      return NextResponse.json({ error: 'Invalid from date' }, { status: 400 });
    }
    if (query.to && !toDate) {
      return NextResponse.json({ error: 'Invalid to date' }, { status: 400 });
    }

    const tenantId = session.user.tenantId;
    const membershipResult = await sql`
      SELECT role
      FROM tenant_members
      WHERE tenant_id = ${tenantId}
        AND user_id = ${session.user.id}
      LIMIT 1
    `;
    const membershipRows = membershipResult as Array<{ role: string }>;
    if (membershipRows.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['owner', 'admin', 'accountant', 'office'].includes(membershipRows[0].role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const whereParts: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];

    if (query.action) {
      params.push(query.action);
      whereParts.push(`action = $${params.length}`);
    }

    if (query.entityType) {
      params.push(query.entityType);
      whereParts.push(`entity_type = $${params.length}`);
    }

    if (fromDate) {
      params.push(fromDate.toISOString());
      whereParts.push(`timestamp >= $${params.length}`);
    }

    if (toDate) {
      params.push(toDate.toISOString());
      whereParts.push(`timestamp <= $${params.length}`);
    }

    const whereClause = whereParts.join(' AND ');
    const offset = (query.page - 1) * query.pageSize;

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM audit_logs
      WHERE ${whereClause}
    `;
    const countRows = await sql.unsafe(countQuery, params);
    const total = Number((countRows as Array<{ total: number }>)[0]?.total || 0);

    const listParams = [...params, query.pageSize, offset];
    const dataQuery = `
      SELECT
        id,
        action,
        entity_type,
        entity_id,
        user_id,
        user_email,
        metadata,
        timestamp
      FROM audit_logs
      WHERE ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;

    const rows = await sql.unsafe(dataQuery, listParams);
    const items = (rows as Array<Record<string, unknown>>).map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      userId: row.user_id,
      userEmail: row.user_email,
      metadata: row.metadata,
      timestamp: row.timestamp,
    }));

    return NextResponse.json({
      success: true,
      data: items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
      filters: {
        action: query.action || null,
        entityType: query.entityType || null,
        from: fromDate?.toISOString() || null,
        to: toDate?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Tenant activity list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
