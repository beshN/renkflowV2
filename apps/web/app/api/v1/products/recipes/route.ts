import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { AuthenticationError, getServerUserContext } from '@/lib/features/auth/serverAuth';
import { canImportProductCards, canImportProductRecipes, assertProductImportAccess } from '@/lib/features/products/import-access.server';
import { can } from '@/lib/security/access-matrix';
import { importFamilyRecipe, productFamiliesOverview, recipeTemplateCsv } from '@/lib/features/products/recipe-template.service';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

function error(e: unknown) {
  if (e instanceof AuthenticationError) return redactedJson({ error: e.message }, { status: 401, headers });
  if (e instanceof WorkOrderApiError) return redactedJson({ error: e.message }, { status: e.status, headers });
  if (e instanceof SyntaxError) return redactedJson({ error: 'Geçersiz JSON veya CSV' }, { status: 400, headers });
  if (e instanceof ZodError) return redactedJson({ error: e.issues.map((i) => i.message).join(', ') }, { status: 400, headers });
  console.error('[family recipes]', e instanceof Error ? e.message : 'failed');
  return redactedJson({ error: 'Reçete işlenemedi.' }, { status: 500, headers });
}

/** GET: families with their recipes; ?template=<family> downloads the family's recipe template. */
export async function GET(req: NextRequest) {
  try {
    const actor = await getServerUserContext();
    const template = req.nextUrl.searchParams.get('template');
    if (template) {
      if (actor.narrowed && !can(actor.narrowed, 'production', 'export')) throw new WorkOrderApiError('Şablon indirme yetkiniz yok', 403);
      return new NextResponse(await recipeTemplateCsv(actor, template), {
        headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="recete-sablonu-${template}.csv"` },
      });
    }
    const data = await productFamiliesOverview(actor);
    return redactedJson({ ...data, canImport: canImportProductRecipes(actor), canCreateCards: canImportProductCards(actor) }, { headers });
  } catch (e) {
    return error(e);
  }
}

/** POST { family, code, name, finishedItemId, fileName, text, dryRun }. */
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 3_000_000);
    const context = await getServerUserContext();
    assertProductImportAccess(context, 'recipes');
    return redactedJson(await importFamilyRecipe(context, await req.json()), { headers });
  } catch (e) {
    return error(e);
  }
}
