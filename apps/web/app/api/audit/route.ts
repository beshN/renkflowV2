import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auditFacets, queryAudit } from '@/lib/audit/audit-log';
import { AUDIT_ROLES, QuerySchema } from '@/lib/audit/query';
import { AuthenticationError, getServerUserContext } from '@/lib/features/auth/serverAuth';

/** Firm audit trail (activity_logs). Owner and admin only. */
export async function GET(request: Request) {
  try {
    const context = await getServerUserContext();
    if (!AUDIT_ROLES.includes(context.role)) {
      return NextResponse.json({ error: 'Denetim kaydına erişim yetkiniz yok.' }, { status: 403 });
    }
    const params = Object.fromEntries(new URL(request.url).searchParams);
    if (params.facets === '1') return NextResponse.json({ success: true, ...(await auditFacets(context.tenantId)) }, { headers: { 'Cache-Control': 'private, no-store' } });
    delete params.facets;
    const q = QuerySchema.parse(params);
    // A date-only end date covers that whole day.
    const to = q.endDate && /^\d{4}-\d{2}-\d{2}$/.test(params.endDate ?? '') ? new Date(q.endDate.getTime() + 86_400_000) : q.endDate;
    const data = await queryAudit(context.tenantId, {
      entityType: q.entityType,
      entityId: q.entityId,
      actorId: q.userId,
      action: q.action,
      from: q.startDate,
      to,
      limit: q.limit,
      offset: q.offset,
    });
    return NextResponse.json({ success: true, ...data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Geçersiz filtre.' }, { status: 400 });
    console.error('[Audit]', error);
    return NextResponse.json({ error: 'Denetim kaydı alınamadı.' }, { status: 500 });
  }
}
