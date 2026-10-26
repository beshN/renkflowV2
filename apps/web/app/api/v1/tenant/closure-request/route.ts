import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { recordAuditAfterCommit } from '@/lib/audit/audit-log';
import { CLOSURE_TICKET_SUBJECT, closureTicketMessage, validateClosureRequest } from '@/lib/features/account/export-plan';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { insertSupportTicket } from '@/lib/features/support/tickets.server';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { consumeRateLimit, rateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

const NEXT_STEPS = {
  exportUrl: '/api/v1/tenant/export',
  processingDays: 30,
  deletionDays: 90,
};

/**
 * "Firma hesabını kapat": deletes nothing. The owner confirms with the firm name; a support ticket
 * is opened for the team and the request is written to the audit trail. A second request while
 * the first is still open returns the open one.
 */
export async function POST(request: NextRequest) {
  try {
    requireSameOriginJson(request, 20_000);
    const actor = await requireWorkOrderActor();
    if (actor.role !== 'owner') throw new WorkOrderApiError('Hesap kapatma talebini yalnız firma sahibi gönderebilir', 403);
    const limit = await consumeRateLimit('accountClosure', `${actor.tenantId}:${actor.userId}`);
    if (!limit.allowed) return rateLimitResponse(limit);

    const body = (await request.json()) as Record<string, unknown>;
    const [tenant] = await sql`SELECT name FROM tenants WHERE id = ${actor.tenantId}`;
    if (!tenant) throw new WorkOrderApiError('Firma bulunamadı', 404);
    const check = validateClosureRequest({ confirmName: body?.confirmName, reason: body?.reason }, String(tenant.name ?? ''));
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400, headers: NO_STORE });

    const [open] = await sql`
      SELECT id, created_at FROM support_tickets
      WHERE tenant_id = ${actor.tenantId} AND subject = ${CLOSURE_TICKET_SUBJECT} AND status IN ('open', 'in_progress')
      ORDER BY created_at DESC LIMIT 1`;
    if (open) {
      return NextResponse.json({ alreadyRequested: true, ticketId: open.id, requestedAt: open.created_at, ...NEXT_STEPS }, { headers: NO_STORE });
    }

    const [user] = await sql`SELECT name, email FROM users WHERE id = ${actor.userId}`;
    const requestedAt = new Date();
    const ticket = await insertSupportTicket(sql, {
      userId: actor.userId, tenantId: actor.tenantId, role: actor.role, email: (user?.email as string) ?? null, name: (user?.name as string) ?? null,
    }, {
      subject: CLOSURE_TICKET_SUBJECT,
      priority: 'high',
      pagePath: '/settings#plan',
      locale: 'tr',
      message: closureTicketMessage({ firmName: String(tenant.name), tenantId: actor.tenantId, requestedBy: String(user?.email ?? actor.userId), reason: check.reason, requestedAt }),
      metadata: { kind: 'account_closure' },
    });
    await recordAuditAfterCommit({
      tenantId: actor.tenantId, actorId: actor.userId, entityType: 'tenant', entityId: actor.tenantId,
      action: 'account_closure_requested', note: check.reason, metadata: { ticketId: ticket.id },
    });
    return NextResponse.json({ alreadyRequested: false, ticketId: ticket.id, requestedAt: ticket.created_at, ...NEXT_STEPS }, { status: 201, headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'account-closure');
  }
}
