import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { checkPrice, importPriceMatrix, priceMatrixOverview, requirePriceMatrixRead } from '@/lib/features/products/price-matrix.service';
import { matrixTemplate } from '@/lib/features/products/price-matrix';
import { productFamily } from '@/lib/features/products/families';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

function error(e: unknown) {
  if (e instanceof WorkOrderApiError) return redactedJson({ error: e.message }, { status: e.status, headers });
  if (e instanceof ZodError) return redactedJson({ error: e.issues.map((i) => i.message).join(', ') }, { status: 400, headers });
  console.error('[price matrix]', e instanceof Error ? e.message : 'failed');
  return redactedJson({ error: 'Fiyat matrisi işlenemedi.' }, { status: 500, headers });
}

/** GET: the families and their matrices; ?template=<family> downloads the empty template. */
export async function GET(req: NextRequest) {
  try {
    const actor = await requireWorkOrderActor();
    const template = req.nextUrl.searchParams.get('template');
    if (template) {
      requirePriceMatrixRead(actor);
      if (!productFamily(template)) throw new WorkOrderApiError('Bilinmeyen ürün ailesi', 400);
      return new NextResponse(matrixTemplate(template), {
        headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="fiyat-matrisi-${template}.csv"` },
      });
    }
    return redactedJson(await priceMatrixOverview(actor), { headers });
  } catch (e) {
    return error(e);
  }
}

/** POST { action: 'import', family, fileName, text, dryRun } or { action: 'check', family, variant, a, b, options }. */
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 3_000_000);
    const actor = await requireWorkOrderActor();
    const body = (await req.json()) as { action?: string };
    if (body?.action === 'import') return redactedJson(await importPriceMatrix(actor, body), { headers });
    if (body?.action === 'check') return redactedJson(await checkPrice(actor, body), { headers });
    throw new WorkOrderApiError('Bilinmeyen işlem', 400);
  } catch (e) {
    return error(e);
  }
}
