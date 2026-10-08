import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { countImports, fileCountImport } from '@/lib/features/warehouse/count-import/service';
import { suggestionsAvailable } from '@/lib/ai/suggestions/service';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

function error(e: unknown) {
  if (e instanceof WorkOrderApiError) return NextResponse.json({ error: e.message }, { status: e.status, headers });
  if (e instanceof ZodError) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400, headers });
  console.error('[count import]', e instanceof Error ? e.message : 'failed');
  return NextResponse.json({ error: 'Sayım listesi işlenemedi.' }, { status: 500, headers });
}

/** GET: imported count lists with their lines. */
export async function GET() {
  try {
    const actor = await requireWorkOrderActor();
    const { sql } = await import('@/lib/db');
    const tables = await sql`SELECT to_regclass('public.stock_count_documents') IS NOT NULL AS ok`;
    if (!tables[0]?.ok || !(await suggestionsAvailable())) return NextResponse.json({ available: false, documents: [], warehouses: [] }, { headers });
    const [documents, warehouses] = await Promise.all([
      countImports(actor),
      sql`SELECT id, code, name FROM warehouses WHERE tenant_id = ${actor.tenantId} AND warehouse_type = 'RAW' AND active = true ORDER BY code`,
    ]);
    return NextResponse.json({ available: true, canImport: ['owner', 'admin'].includes(actor.role), documents, warehouses }, { headers });
  } catch (e) {
    return error(e);
  }
}

/** POST { fileName, base64, warehouseId }: reads the PDF and files it as a suggestion to approve. */
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 4_500_000);
    if (!(await suggestionsAvailable())) return NextResponse.json({ error: 'Öneri kuyruğu kurulu değil.' }, { status: 503, headers });
    return NextResponse.json({ data: await fileCountImport(await requireWorkOrderActor(), await req.json()) }, { headers });
  } catch (e) {
    return error(e);
  }
}
