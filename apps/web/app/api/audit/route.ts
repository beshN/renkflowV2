import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { queryAuditLogs, type AuditAction } from '@/lib/audit/logging';

function parseDate(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const actionParam = searchParams.get('action');
  const allowedActions = new Set<AuditAction>([
    'order:created',
    'order:updated',
    'order:deleted',
    'order:status_changed',
    'document:uploaded',
    'document:deleted',
    'user:login',
    'user:login_failed',
    'user:logout',
    'user:invited',
    'user:role_changed',
    'settings:updated',
    'export:generated',
    'report:viewed',
  ]);
  const action = actionParam && allowedActions.has(actionParam as AuditAction)
    ? (actionParam as AuditAction)
    : undefined;
  const data = await queryAuditLogs({
    tenantId: session.user.tenantId,
    action,
    entityType: searchParams.get('entityType') || undefined,
    entityId: searchParams.get('entityId') || undefined,
    userId: searchParams.get('userId') || undefined,
    startDate: parseDate(searchParams.get('startDate')),
    endDate: parseDate(searchParams.get('endDate')),
    limit: Number(searchParams.get('limit') || 50),
    offset: Number(searchParams.get('offset') || 0),
  });

  return NextResponse.json({ success: true, ...data });
}
