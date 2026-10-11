import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { importFamilyRecipe, productFamiliesOverview, recipeTemplateCsv } from '@/lib/features/products/recipe-template.service';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

function error(e: unknown) {
  if (e instanceof WorkOrderApiError) return redactedJson({ error: e.message }, { status: e.status, headers });
  if (e instanceof ZodError) return redactedJson({ error: e.issues.map((i) => i.message).join(', ') }, { status: 400, headers });
  console.error('[family recipes]', e instanceof Error ? e.message : 'failed');
  return redactedJson({ error: 'Reçete işlenemedi.' }, { status: 500, headers });
}

/** GET: families with their recipes; ?template=<family> downloads the family's recipe template. */
export async function GET(req: NextRequest) {
  try {
    const actor = await requireWorkOrderActor();
    const template = req.nextUrl.searchParams.get('template');
    if (template)
      return new NextResponse(await recipeTemplateCsv(actor, template), {
        headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="recete-sablonu-${template}.csv"` },
      });
    return redactedJson(await productFamiliesOverview(actor), { headers });
  } catch (e) {
    return error(e);
  }
}

/** POST { family, code, name, finishedItemId, fileName, text, dryRun }. */
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 3_000_000);
    return redactedJson(await importFamilyRecipe(await requireWorkOrderActor(), await req.json()), { headers });
  } catch (e) {
    return error(e);
  }
}
