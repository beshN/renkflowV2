import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { colorCatalogSettings, saveColorCatalog } from '@/lib/features/settings/color-catalog.service';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

function error(e: unknown) {
  if (e instanceof WorkOrderApiError) return redactedJson({ error: e.message }, { status: e.status, headers });
  if (e instanceof ZodError) return redactedJson({ error: e.issues.map((i) => i.message).join(', ') }, { status: 400, headers });
  if (e instanceof SyntaxError) return redactedJson({ error: 'Geçersiz istek' }, { status: 400, headers });
  // Two saves at once: the other one's list is now the catalogue.
  if ((e as { code?: string })?.code === '23505') return redactedJson({ error: 'Renk adı listede iki kez geçiyor' }, { status: 409, headers });
  console.error('[color catalog]', e instanceof Error ? e.message : 'failed');
  return redactedJson({ error: 'Sık kullanılan renkler işlenemedi.' }, { status: 500, headers });
}

export async function GET() {
  try {
    return redactedJson(await colorCatalogSettings(await requireWorkOrderActor()), { headers });
  } catch (e) {
    return error(e);
  }
}

/** PUT { colors: string[] } replaces the catalogue in the given order. */
export async function PUT(req: NextRequest) {
  try {
    requireSameOriginJson(req, 100_000);
    return redactedJson(await saveColorCatalog(await requireWorkOrderActor(), await req.json()), { headers });
  } catch (e) {
    return error(e);
  }
}
