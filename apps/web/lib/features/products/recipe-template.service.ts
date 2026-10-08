import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { tableExists } from '@/lib/db/schema-guard';
import { recordAuditAfterCommit } from '@/lib/audit/audit-log';
import { productionCommand } from '@/lib/features/manufacturing/platform.service';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { PRODUCT_FAMILIES, productFamily } from './families';
import { readRecipeCsv, recipeTemplate, type TemplateItem } from './recipe-template';

const fail = (message: string, status = 400): never => {
  throw new WorkOrderApiError(message, status);
};
const MANAGERS = ['owner', 'admin'];
const READERS = ['owner', 'admin', 'office'];
export const familyRecipesAvailable = () => tableExists('product_family_recipes');

async function context(tenantId: string) {
  const [items, centers] = await Promise.all([
    sql`SELECT id, sku, name, profile_code, stock_uom FROM inventory_items WHERE tenant_id = ${tenantId} AND active = true AND item_type <> 'finished_good' ORDER BY sku`,
    sql`SELECT code FROM work_centers WHERE tenant_id = ${tenantId} AND active = true ORDER BY code`,
  ]);
  return {
    items: items.map((i: any): TemplateItem => ({ id: i.id, sku: i.sku, name: i.name, profileCode: i.profile_code, uom: i.stock_uom })),
    workCenters: centers.map((c: any) => c.code as string),
  };
}

export async function recipeTemplateCsv(actor: WorkOrderActor, family: string) {
  if (!MANAGERS.includes(actor.role)) fail('Reçete şablonunu firma yöneticisi indirir', 403);
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
    canImport: MANAGERS.includes(actor.role),
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
});

/**
 * A filled recipe template becomes a draft recipe of the family: a new version of the code, or the
 * code's current draft updated. Publishing stays in the recipe screen, after worked examples.
 */
export async function importFamilyRecipe(actor: WorkOrderActor, raw: unknown) {
  if (!MANAGERS.includes(actor.role)) fail('Reçeteyi firma yöneticisi yükler', 403);
  const input = ImportSchema.parse(raw);
  if (!productFamily(input.family)) fail('Bilinmeyen ürün ailesi');
  const read = readRecipeCsv(input.text, await context(actor.tenantId));
  if (!read.ok) return { ok: false as const, errors: read.errors };
  const summary = {
    materials: read.parts.rules.length,
    profiles: read.parts.rules.filter((r) => r.kind === 'profile').length,
    parameters: read.parts.parameterDefinitions?.length ?? 0,
    operations: read.parts.operations.length,
    checks: read.parts.constraints?.length ?? 0,
    skipped: read.skipped,
    limits: read.parts.limits,
  };
  if (input.dryRun) return { ok: true as const, dryRun: true, summary };
  if (!(await familyRecipesAvailable())) fail('Bu kurulumda ürün reçeteleri henüz etkin değil (veritabanı güncellemesi bekleniyor)', 409);
  const [owner] = await sql`SELECT family FROM product_family_recipes WHERE tenant_id = ${actor.tenantId} AND recipe_code = ${input.code}`;
  if (owner && owner.family !== input.family) fail(`"${input.code}" kodu başka bir ürün ailesinin reçetesi`, 409);
  if (!owner && (await sql`SELECT 1 FROM production_recipes WHERE tenant_id = ${actor.tenantId} AND code = ${input.code} LIMIT 1`).length)
    fail(`"${input.code}" kodu reçete ekranında başka bir reçeteye ait; başka kod seçin`, 409);
  const [latest] = await sql`SELECT version, status, edit_revision FROM production_recipes WHERE tenant_id = ${actor.tenantId} AND code = ${input.code} ORDER BY version DESC LIMIT 1`;
  const draft = latest?.status === 'draft';
  const saved: any = await productionCommand(actor, {
    commandId: randomUUID(),
    action: 'recipe.save',
    data: {
      code: input.code,
      name: input.name,
      version: draft ? latest.version : (latest?.version ?? 0) + 1,
      editRevision: draft ? latest.edit_revision : undefined,
      finishedItemId: input.finishedItemId,
      examples: [],
      ...read.parts,
    },
  });
  await sql`INSERT INTO product_family_recipes (tenant_id, recipe_code, family, created_by) VALUES (${actor.tenantId}, ${input.code}, ${input.family}, ${actor.userId})
    ON CONFLICT (tenant_id, recipe_code) DO NOTHING`;
  await recordAuditAfterCommit({
    tenantId: actor.tenantId,
    actorId: actor.userId,
    entityType: 'production_recipe',
    entityId: saved.id,
    action: 'imported',
    metadata: { family: input.family, code: input.code, version: saved.version, fileName: input.fileName, ...summary },
  });
  return { ok: true as const, dryRun: false, summary, recipe: { id: saved.id as string, code: saved.code as string, version: saved.version as number } };
}
