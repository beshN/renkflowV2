import { NextRequest } from 'next/server';
import { redactedJson } from '@/lib/security/field-access.server';
import { sql } from '@/lib/db';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { customerErrorResponse } from '@/lib/features/customers/api';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { requireProcurementWrite } from '@/lib/features/manufacturing/purchasing.service';
import { importSuppliers } from '@/lib/features/suppliers/import.server';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 2_500_000);
    const actor = await requireWorkOrderActor();
    requireProcurementWrite(actor);
    return redactedJson(await importSuppliers(sql, actor, await req.json()), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Error && /^(Dosyada|Tedarikçi adı sütunu|Tek seferde)/.test(error.message)) return redactedJson({ error: error.message }, { status: 400 });
    return customerErrorResponse(error, 'Tedarikçi listesi aktarılamadı.');
  }
}
