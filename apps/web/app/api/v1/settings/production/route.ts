import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { productionSettings, saveProductionLead } from '@/lib/features/settings/production-settings.service';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

function error(e: unknown) {
  if (e instanceof WorkOrderApiError) return redactedJson({ error: e.message }, { status: e.status, headers });
  if (e instanceof ZodError || e instanceof SyntaxError) return redactedJson({ error: 'Geçersiz seçim' }, { status: 400, headers });
  console.error('[production settings]', e instanceof Error ? e.message : 'failed');
  return redactedJson({ error: 'Üretim ayarları işlenemedi.' }, { status: 500, headers });
}

export async function GET() {
  try {
    return redactedJson(await productionSettings(await requireWorkOrderActor()), { headers });
  } catch (e) {
    return error(e);
  }
}

/** PUT { leadUserId: uuid | null } */
export async function PUT(req: NextRequest) {
  try {
    requireSameOriginJson(req, 10_000);
    return redactedJson(await saveProductionLead(await requireWorkOrderActor(), await req.json()), { headers });
  } catch (e) {
    return error(e);
  }
}
