import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { redactedJson } from '@/lib/security/field-access.server';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { AuthenticationError, getServerUserContext } from '@/lib/features/auth/serverAuth';
import { assertProductImportAccess } from '@/lib/features/products/import-access.server';
import { importMaterialCards } from '@/lib/features/products/material-import.server';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 4_500_000);
    const context = await getServerUserContext();
    assertProductImportAccess(context, 'cards');
    return redactedJson(await importMaterialCards(context, await req.json()), { headers });
  } catch (e) {
    if (e instanceof AuthenticationError) return redactedJson({ error: e.message }, { status: 401, headers });
    if (e instanceof WorkOrderApiError) return redactedJson({ error: e.message }, { status: e.status, headers });
    if (e instanceof ZodError || e instanceof SyntaxError) return redactedJson({ error: 'Geçersiz aktarım isteği' }, { status: 400, headers });
    console.error('[product import] failed');
    return redactedJson({ error: 'Ürün kartları aktarılamadı' }, { status: 500, headers });
  }
}
