import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest } from 'next/server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { getQuoteSettings, salesAvailable, saveQuoteSettings } from '@/lib/features/sales/quotes.server';

export const dynamic = 'force-dynamic';

/** The firm's quote rules: discount approval threshold, default validity days and VAT rate. */
export async function GET() {
  try {
    const actor = await requireWorkOrderActor();
    if (actor.role === 'worker') throw new WorkOrderApiError('Teklif ayarlarını görme yetkiniz yok', 403);
    return redactedJson({ available: await salesAvailable(), settings: await getQuoteSettings(actor.tenantId) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'sales-settings');
  }
}

export async function PUT(req: NextRequest) {
  try {
    requireSameOriginJson(req, 2_000);
    return redactedJson({ available: true, settings: await saveQuoteSettings(await requireWorkOrderActor(), await req.json()) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'sales-settings');
  }
}
