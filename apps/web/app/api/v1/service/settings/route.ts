import { NextRequest } from 'next/server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { saveWarrantyMonths, warrantyMonths } from '@/lib/features/field/service.server';
import { requireChain } from '@/lib/features/field/common.server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const actor = await requireWorkOrderActor();
    await requireChain();
    return redactedJson({ warrantyMonths: await warrantyMonths(actor.tenantId) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'service-settings');
  }
}

/** { warrantyMonths } — settings edit. */
export async function PUT(req: NextRequest) {
  try {
    requireSameOriginJson(req, 2_000);
    return redactedJson(await saveWarrantyMonths(await requireWorkOrderActor(), await req.json()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'service-settings');
  }
}
