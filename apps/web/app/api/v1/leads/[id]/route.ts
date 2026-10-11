import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { convertLead, createSurvey, getLead, moveLead, updateLead } from '@/lib/features/field/leads.server';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };
const id = async (params: Params['params']) => z.string().uuid().parse((await params).id);

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    return redactedJson(await getLead(await requireWorkOrderActor(), await id(params)), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'lead');
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    requireSameOriginJson(req, 20_000);
    const actor = await requireWorkOrderActor();
    const leadId = await id(params);
    await updateLead(actor, leadId, await req.json());
    return redactedJson(await getLead(actor, leadId), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'lead');
  }
}

/** { action: 'move', to, lostReason?, lostNote? } | { action: 'convert' } | { action: 'survey', scheduledAt?, address?, assignedTo?, productFamily? } */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    requireSameOriginJson(req, 20_000);
    const actor = await requireWorkOrderActor();
    const leadId = await id(params);
    const { action, ...body } = (await req.json()) as { action?: string } & Record<string, unknown>;
    if (action === 'move') return redactedJson(await moveLead(actor, leadId, body), { headers: NO_STORE });
    if (action === 'convert') return redactedJson(await convertLead(actor, leadId), { headers: NO_STORE });
    if (action === 'survey') return redactedJson(await createSurvey(actor, leadId, body), { status: 201, headers: NO_STORE });
    return redactedJson({ error: 'Bilinmeyen işlem' }, { status: 400, headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'lead');
  }
}
