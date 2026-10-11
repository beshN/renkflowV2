import { NextRequest } from 'next/server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { getAiSettings, saveAiSettings } from '@/lib/ai/settings.server';
import { aiAvailable } from '@/lib/ai/service';
import { listDetectors } from '@/lib/ai/detectors/registry.server';
import { detectorSettings } from '@/lib/ai/detectors/engine';

export const dynamic = 'force-dynamic';

async function view(tenantId: string) {
  const s = await getAiSettings(tenantId);
  return {
    ...s, modelKeyConfigured: aiAvailable(),
    detectors: listDetectors().map((d) => ({ key: d.key, label: d.label, icon: d.icon, thresholdLabel: d.thresholdLabel ?? null, defaults: d.defaults, ...detectorSettings(d.defaults, s.detectors[d.key]) })),
  };
}

/** The firm's assistant settings (owner/admin): mode, KVKK confirmation, caps, detectors, features. */
export async function GET() {
  try {
    const actor = await requireWorkOrderActor();
    if (actor.role !== 'owner' && actor.role !== 'admin') throw new WorkOrderApiError('Bulunamadı', 404);
    return redactedJson(await view(actor.tenantId), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'ai-settings');
  }
}

export async function PUT(req: NextRequest) {
  try {
    requireSameOriginJson(req, 20_000);
    const actor = await requireWorkOrderActor();
    await saveAiSettings(actor, await req.json());
    return redactedJson(await view(actor.tenantId), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'ai-settings');
  }
}
