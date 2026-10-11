import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { getTicket, updateTicket } from '@/lib/features/field/service.server';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };
const id = async (params: Params['params']) => z.string().uuid().parse((await params).id);

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    return redactedJson(await getTicket(await requireWorkOrderActor(), await id(params)), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'ticket');
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    requireSameOriginJson(req, 40_000);
    return redactedJson(await updateTicket(await requireWorkOrderActor(), await id(params), await req.json()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'ticket');
  }
}
