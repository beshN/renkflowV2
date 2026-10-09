import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { recordScrap, reportDelay, resolveDelay, workOrderDepth } from '@/lib/features/production/depth.server';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };

/** Scrap and delays on a job with the firm's reasons (a worker sees only their own job; no prices). */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    return NextResponse.json(await workOrderDepth(await requireWorkOrderActor(), (await params).id), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'job-depth');
  }
}

const Command = z.object({ action: z.enum(['scrap', 'delay', 'resolve_delay']) }).passthrough();

export async function POST(req: NextRequest, { params }: Params) {
  try {
    requireSameOriginJson(req, 20_000);
    const actor = await requireWorkOrderActor();
    const { id } = await params;
    const { action, ...body } = Command.parse(await req.json());
    const result = action === 'scrap' ? await recordScrap(actor, id, body) : action === 'delay' ? await reportDelay(actor, id, body) : await resolveDelay(actor, id);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'job-depth');
  }
}
