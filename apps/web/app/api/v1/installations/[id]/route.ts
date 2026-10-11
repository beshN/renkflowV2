import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { addIssue, createSignoffLink, getInstallation, updateInstallation } from '@/lib/features/field/installations.server';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };
const id = async (params: Params['params']) => z.string().uuid().parse((await params).id);

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    return redactedJson(await getInstallation(await requireWorkOrderActor(), await id(params)), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'installation');
  }
}

/** Reschedule, crew, status. Answers the conflicts the change leaves. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    requireSameOriginJson(req, 20_000);
    return redactedJson(await updateInstallation(await requireWorkOrderActor(), await id(params), await req.json()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'installation');
  }
}

/** { action: 'issue', kind, text } | { action: 'signoff' } (the link is shown once) */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    requireSameOriginJson(req, 20_000);
    const actor = await requireWorkOrderActor();
    const installationId = await id(params);
    const { action, ...body } = (await req.json()) as { action?: string } & Record<string, unknown>;
    if (action === 'issue') { await addIssue(actor, installationId, body); return redactedJson({ ok: true }, { headers: NO_STORE }); }
    if (action === 'signoff') return redactedJson(await createSignoffLink(actor, installationId), { headers: NO_STORE });
    return redactedJson({ error: 'Bilinmeyen işlem' }, { status: 400, headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'installation');
  }
}
