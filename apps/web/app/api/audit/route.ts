import { NextResponse } from 'next/server';
import { z } from 'zod';
import { queryAudit } from '@/lib/audit/audit-log';
import { AuthenticationError, getServerUserContext } from '@/lib/features/auth/serverAuth';

const AUDIT_ROLES = ['owner', 'admin'];

const QuerySchema = z.object({
  entityType: z.string().trim().max(60).optional(),
  entityId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  action: z.string().trim().max(80).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

/** Firm audit trail (activity_logs). Owner and admin only. */
export async function GET(request: Request) {
  try {
    const context = await getServerUserContext();
    if (!AUDIT_ROLES.includes(context.role)) {
      return NextResponse.json({ error: 'Denetim kaydına erişim yetkiniz yok.' }, { status: 403 });
    }
    const params = Object.fromEntries(new URL(request.url).searchParams);
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
