import { NextRequest } from 'next/server';
import { redactedJson } from '@/lib/security/field-access.server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { kioskJobs, kioskCommand } from '@/lib/features/kiosk/service.server';
import { NO_STORE, recordError } from '@/lib/features/records/http';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return redactedJson({ jobs: await kioskJobs(await requireWorkOrderActor()) }, { headers: NO_STORE }); }
  catch (e) { return recordError(e, 'kiosk-list'); }
}
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 10000);
    await kioskCommand(await requireWorkOrderActor(), await req.json());
    return redactedJson({ ok: true }, { headers: NO_STORE });
  } catch (e) { return recordError(e, 'kiosk-command'); }
}
