import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { tableExists } from '@/lib/db/schema-guard';
import { recordAudit } from '@/lib/audit/audit-log';
import { productionCommandInTransaction } from '@/lib/features/manufacturing/platform.service';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { ROUTE_ROLES } from '@/lib/features/auth/permissions';
import { PRODUCT_FAMILIES, productFamily } from './families';
import { FIRM_MANAGER_ROLES } from '@/lib/features/settings/roles';
import { readRecipeCsv, recipeTemplate, type TemplateItem } from './recipe-template';

const fail = (message: string, status = 400): never => {
  throw new WorkOrderApiError(message, status);
};

const READERS = ROUTE_ROLES['/products'] as string[];
export const familyRecipesAvailable = () => tableExists('product_family_recipes');

async function context(tenantId: string, db: any = sql) {
  const [items, centers] = await Promise.all([
    db`SELECT id, sku, name, profile_code, stock_uom FROM inventory_items WHERE tenant_id = ${tenantId} AND active = true AND item_type <> 'finished_good' ORDER BY sku LIMIT 10001`,
    db`SELECT code FROM work_centers WHERE tenant_id = ${tenantId} AND active = true ORDER BY code LIMIT 10001`,
  ]);
  if (items.length > 10000 || centers.length > 10000) fail('Reçete aktarımı için çok fazla aday kart var; listeyi daraltın', 413);
  return {
    items: items.map((i: any): TemplateItem => ({ id: i.id, sku: i.sku, name: i.name, profileCode: i.profile_code, uom: i.stock_uom })),
    workCenters: centers.map((c: any) => c.code as string),
  };
}

export async function recipeTemplateCsv(actor: WorkOrderActor, family: string) {
  if (!FIRM_MANAGER_ROLES.includes(actor.role)) fail('Reçete şablonunu firma yöneticisi indirir', 403);
  if (!productFamily(family)) fail('Bilinmeyen ürün ailesi');
  const ctx = await context(actor.tenantId);
  return recipeTemplate(family, ctx.items, ctx.workCenters);
}

/** The families, their recipes (latest version of each code) and the finished-good cards a recipe can make. */
export async function productFamiliesOverview(actor: WorkOrderActor) {
  if (!READERS.includes(actor.role)) fail('Ürün reçetelerine erişim yok', 403);
  const available = await familyRecipesAvailable();
  const [recipes, finished] = await Promise.all([
    available
      ? sql`SELECT DISTINCT ON (r.code) m.family, r.id, r.code, r.name, r.version, r.status, r.edit_revision, r.created_at,
            jsonb_array_length(r.rules) AS rule_count, jsonb_array_length(r.examples) AS example_count
          FROM product_family_recipes m JOIN production_recipes r ON r.tenant_id = m.tenant_id AND r.code = m.recipe_code
          WHERE m.tenant_id = ${actor.tenantId} ORDER BY r.code, r.version DESC`
      : [],
    sql`SELECT id, sku, name FROM inventory_items WHERE tenant_id = ${actor.tenantId} AND active = true AND item_type = 'finished_good' ORDER BY name`,
  ]);
  return {
    available,
    canImport: FIRM_MANAGER_ROLES.includes(actor.role),
    families: PRODUCT_FAMILIES.map((f) => ({ key: f.key, label: f.label, profileCodes: f.profileCodes, recipes: recipes.filter((r: any) => r.family === f.key) })),
    finishedItems: finished,
  };
}

const ImportSchema = z.object({
  family: z.string().max(40),
  code: z.string().trim().min(2, 'Reçete kodu en az 2 karakter').max(60).regex(/^[A-Za-z0-9._-]+$/, 'Reçete kodu harf, rakam, nokta, tire'),
  name: z.string().trim().min(2, 'Reçete adı gerekli').max(180),
  finishedItemId: z.string().uuid('Mamul kartı seçin'),
  fileName: z.string().trim().max(200).default('recete.csv'),
  text: z.string().min(1, 'Dosya boş').max(1_000_000, 'Dosya en fazla 1 MB olabilir'),
  dryRun: z.boolean().default(true),
  previewHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});

/**
 * A filled recipe template becomes a draft recipe of the family: a new version of the code, or the
 * code's current draft updated. Publishing stays in the recipe screen, after worked examples.
 */
export async function importFamilyRecipe(actor: WorkOrderActor, raw: unknown) {
  if (!FIRM_MANAGER_ROLES.includes(actor.role)) fail('Reçeteyi firma yöneticisi yükler', 403);
  const input = ImportSchema.parse(raw);
  if (!productFamily(input.family)) fail('Bilinmeyen ürün ailesi');
  if (!(await familyRecipesAvailable())) fail('Bu kurulumda ürün reçeteleri henüz etkin değil (veritabanı güncellemesi bekleniyor)', 409);
  return withTransaction(async (tx: any) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${actor.tenantId}, 0))`;
    const ctx = await context(actor.tenantId, tx);
    let read;
    try { read = readRecipeCsv(input.text, ctx); }
    catch { return { ok: false as const, errors: ['CSV okunamadı. Tırnakları ve başlığı kontrol edin.'] }; }
    if (!read.ok) return { ok: false as const, errors: read.errors };
    const t = actor.tenantId;
    const [finished] = await tx`SELECT id, sku, name, stock_uom, item_type, active FROM inventory_items WHERE tenant_id=${t} AND id=${input.finishedItemId} FOR SHARE`;
    if (!finished || !finished.active || finished.item_type !== 'finished_good') fail('Çıktı kartı mamul olmalı ve bu firmada etkin bulunmalı', 400);
    // Keep referenced material and centre changes out of the validation-to-save window.
    const ids = read.parts.rules.map((r) => r.itemId);
    const codes = read.parts.operations.map((r) => r.workCenterCode);
    const referenced = await tx`SELECT id, sku, name, stock_uom, item_type, active FROM inventory_items WHERE tenant_id=${t} AND id=ANY(${ids}::uuid[]) ORDER BY id FOR SHARE`;
    const centers = await tx`SELECT id, code, name, active FROM work_centers WHERE tenant_id=${t} AND code=ANY(${codes}::text[]) ORDER BY id FOR SHARE`;
    const [owner] = await tx`SELECT family FROM product_family_recipes WHERE tenant_id=${t} AND recipe_code=${input.code}`;
    const [latest] = await tx`SELECT id, version, status, edit_revision, examples, rules, operations, limits, finished_item_id, name, parameter_definitions, constraints FROM production_recipes WHERE tenant_id=${t} AND code=${input.code} ORDER BY version DESC LIMIT 1 FOR UPDATE`;
    if (owner && owner.family !== input.family) fail(`"${input.code}" kodu başka bir ürün ailesinin reçetesi`, 409);
    if (!owner && latest) fail(`"${input.code}" kodu reçete ekranında başka bir reçeteye ait; başka kod seçin`, 409);
    const previewHash = createHash('sha256').update(JSON.stringify({
      tenant: t, user: actor.userId, ...input, dryRun: undefined, previewHash: undefined,
      parts: read.parts, referenced, centers, finished, owner: owner ?? null, latest: latest ?? null,
    })).digest('hex');
    const summary = {
      materials: read.parts.rules.length,
      profiles: read.parts.rules.filter((r) => r.kind === 'profile').length,
      parameters: read.parts.parameterDefinitions?.length ?? 0,
      operations: read.parts.operations.length,
      checks: read.parts.constraints?.length ?? 0,
      skipped: read.skipped,
      limits: read.parts.limits,
    };
    if (input.dryRun) return { ok: true as const, dryRun: true, summary, previewHash };
    if (input.previewHash !== previewHash) fail('Reçete önizlemesi değişti veya eksik. Dosyayı yeniden önizleyin.', 409);
    if (!owner) await tx`INSERT INTO product_family_recipes (tenant_id, recipe_code, family, created_by) VALUES (${t},${input.code},${input.family},${actor.userId})`;
    const draft = latest?.status === 'draft';
    const saved = await productionCommandInTransaction(tx, actor, {
      commandId: randomUUID(), action: 'recipe.save', data: {
        code: input.code, name: input.name,
        version: draft ? latest.version : (latest?.version ?? 0) + 1,
        editRevision: draft ? latest.edit_revision : undefined,
        finishedItemId: input.finishedItemId,
        examples: draft ? latest.examples : [], ...read.parts,
      },
    });
    await recordAudit(tx, {
      tenantId: t, actorId: actor.userId, entityType: 'production_recipe', entityId: saved.id,
      action: 'imported', metadata: { family: input.family, code: input.code, version: saved.version, fileName: input.fileName, ...summary },
    });
    return { ok: true as const, dryRun: false, summary, previewHash, recipe: { id: saved.id as string, code: saved.code as string, version: saved.version as number } };
  });
}
