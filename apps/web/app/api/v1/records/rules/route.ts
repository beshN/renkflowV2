import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { listRules, setRule } from '@/lib/features/records/rules';
import { NO_STORE, recordError } from '@/lib/features/records/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return redactedJson(await listRules(await requireWorkOrderActor()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'rules');
  }
}
/** PUT { key, enabled } */
export async function PUT(req: NextRequest) {
  try {
    requireSameOriginJson(req, 2_000);
    const body = z.object({ key: z.string().max(60), enabled: z.boolean() }).parse(await req.json());
    return redactedJson(await setRule(await requireWorkOrderActor(), body.key, body.enabled), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'rules');
  }
}
