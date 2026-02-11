import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { z } from 'zod';

const ParamsSchema = z.object({
  ticketId: z.string().uuid(),
});

const UpdateTicketSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
}).refine((input) => Object.keys(input).length > 0, { message: 'No changes supplied' });

const ALLOWED_ROLES = new Set(['owner', 'admin', 'office']);

type SupportActor = {
  userId: string;
  tenantId: string;
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

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ ticketId: string }> }
) {
  try {
    const actor = await resolveSupportActor();
    const params = await context.params;
    const parsed = ParamsSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 });
    }

    const rows = await sql`
      SELECT *
      FROM support_tickets
      WHERE id = ${parsed.data.ticketId}
        AND tenant_id = ${actor.tenantId}
      LIMIT 1
    `;
    const ticket = (rows as Array<Record<string, unknown>>)[0];
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: ticket });
  } catch (error) {
    const mapped = actorErrorToResponse(error);
    if (mapped) return mapped;

    console.error('Support ticket detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ ticketId: string }> }
) {
  try {
    const actor = await resolveSupportActor();
    const params = await context.params;
    const parsedParams = ParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 });
    }

    const body = await request.json();
    const parsedBody = UpdateTicketSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: z.flattenError(parsedBody.error) },
        { status: 400 }
      );
    }

    const updatedRows = await sql`
      UPDATE support_tickets
      SET
        status = COALESCE(${parsedBody.data.status || null}, status),
        priority = COALESCE(${parsedBody.data.priority || null}, priority),
        updated_at = NOW(),
        metadata = COALESCE(metadata, '{}'::jsonb) || ${{
          updatedBy: actor.userId,
        }}::jsonb
      WHERE id = ${parsedParams.data.ticketId}
        AND tenant_id = ${actor.tenantId}
      RETURNING *
    `;

    const updated = (updatedRows as Array<Record<string, unknown>>)[0];
    if (!updated) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const mapped = actorErrorToResponse(error);
    if (mapped) return mapped;

    console.error('Support ticket update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
