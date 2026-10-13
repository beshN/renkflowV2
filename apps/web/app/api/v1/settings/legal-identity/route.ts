import { NextRequest } from 'next/server';
import { redactedJson } from '@/lib/security/field-access.server';
import { ZodError } from 'zod';
import { sql } from '@/lib/db';
import { getLegalIdentity, saveLegalIdentity } from '@/lib/features/einvoice/identity.server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

function error(e: unknown) {
  if (e instanceof WorkOrderApiError) return redactedJson({ error: e.message }, { status: e.status, headers });
  if (e instanceof ZodError) return redactedJson({ error: e.issues.map((i) => i.message).join(', ') }, { status: 400, headers });
  if (e instanceof SyntaxError) return redactedJson({ error: 'Geçersiz istek' }, { status: 400, headers });
  console.error('[legal identity]', e instanceof Error ? e.message : 'failed');
  return redactedJson({ error: 'Fatura bilgileri işlenemedi.' }, { status: 500, headers });
}

async function requireManager() {
  const actor = await requireWorkOrderActor();
  if (!['owner', 'admin'].includes(actor.role)) throw new WorkOrderApiError('Fatura bilgilerini firma yöneticisi değiştirebilir.', 403);
  return actor;
}

/** The firm's legal identity for invoices; { available: false } until migration 053. */
export async function GET() {
  try {
    const actor = await requireManager();
    const identity = await getLegalIdentity(sql, actor.tenantId);
    return redactedJson(identity ? { available: true, identity } : { available: false }, { headers });
  } catch (e) {
    return error(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    requireSameOriginJson(req, 20_000);
    const actor = await requireManager();
    if (!(await getLegalIdentity(sql, actor.tenantId))) throw new WorkOrderApiError('Fatura bilgileri bu kurulumda henüz etkin değil.', 503);
    return redactedJson({ available: true, identity: await saveLegalIdentity(sql, actor, await req.json()) }, { headers });
  } catch (e) {
    return error(e);
  }
}
