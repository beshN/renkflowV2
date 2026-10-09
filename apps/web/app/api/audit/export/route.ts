import { NextResponse } from 'next/server';
import { z } from 'zod';
import { queryAudit } from '@/lib/audit/audit-log';
import { auditCsv, type AuditCsvRow } from '@/lib/audit/audit-csv';
import { auditActionLabel, auditEntityLabel } from '@/lib/audit/labels';
import { AuthenticationError, getServerUserContext } from '@/lib/features/auth/serverAuth';
import { consumeRateLimit, rateLimitResponse } from '@/lib/security/rate-limit';
import { AUDIT_ROLES, QuerySchema } from '@/lib/audit/query';

/** The filtered audit trail as CSV (up to 5000 rows). Owner and admin; the proxy checks audit export. */
export async function GET(request: Request) {
  try {
    const context = await getServerUserContext();
    if (!AUDIT_ROLES.includes(context.role)) return NextResponse.json({ error: 'Denetim kaydına erişim yetkiniz yok.' }, { status: 403 });
    const limit = await consumeRateLimit('exportCreate', context.userId);
    if (!limit.allowed) return rateLimitResponse(limit);
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const q = QuerySchema.omit({ limit: true, offset: true }).parse(params);
    const to = q.endDate && /^\d{4}-\d{2}-\d{2}$/.test(params.endDate ?? '') ? new Date(q.endDate.getTime() + 86_400_000) : q.endDate;
    const { items } = await queryAudit(context.tenantId, { entityType: q.entityType, entityId: q.entityId, actorId: q.userId, action: q.action, from: q.startDate, to, limit: 5000, offset: 0 });
    const csv = auditCsv(items as unknown as AuditCsvRow[], { action: auditActionLabel, entity: auditEntityLabel });
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="denetim-izi-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Geçersiz filtre.' }, { status: 400 });
    console.error('[Audit export]', error);
    return NextResponse.json({ error: 'Dışa aktarılamadı.' }, { status: 500 });
  }
}
