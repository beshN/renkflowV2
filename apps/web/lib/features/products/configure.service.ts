import 'server-only';

import { sql } from '@/lib/db';
import { tableExists } from '@/lib/db/schema-guard';
import { calculateRecipe } from '@/lib/features/manufacturing/recipe-engine';
import { recipe as recipeDefinition } from '@/lib/features/manufacturing/platform.service';
import { canEditQuotation } from '@/lib/features/quotations/permissions';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { ConfigurationChoiceSchema, type ConfigurationChoice, type PriceState, type ProductConfiguration } from './configuration';
import { productFamily, type ProductFamily } from './families';
import { activeMatrix, quotePrice } from './price-matrix.service';
import { familyRecipesAvailable } from './recipe-template.service';

const fail = (message: string, status = 400): never => {
  throw new WorkOrderApiError(message, status);
};

const UNPAINTED = 'Boyasız';
const sameText = (a: string, b: string) => a.localeCompare(b, 'tr-TR', { sensitivity: 'base' }) === 0;

/**
 * The colours a family is quoted in: those the count list printed for its profile codes and those
 * on its bars in stock, plus "Boyasız" when the family has unpainted cards. No colour is invented.
 */
export async function familyColors(db: any, tenantId: string, family: ProductFamily): Promise<string[]> {
  const codes = [...family.profileCodes];
  const [counted, bars, unpainted] = await Promise.all([
    (await tableExists('stock_count_lines'))
      ? db`SELECT DISTINCT trim(color) AS color FROM stock_count_lines WHERE tenant_id = ${tenantId} AND code = ANY(${codes}::text[]) AND coalesce(trim(color), '') <> ''`
      : [],
    db`SELECT DISTINCT trim(l.metadata->>'color') AS color FROM stock_lots l JOIN inventory_items i ON i.id = l.item_id AND i.tenant_id = l.tenant_id
      WHERE l.tenant_id = ${tenantId} AND i.profile_code = ANY(${codes}::text[]) AND l.remaining_qty > 0 AND coalesce(trim(l.metadata->>'color'), '') <> ''`,
    db`SELECT 1 FROM inventory_items WHERE tenant_id = ${tenantId} AND active = true AND profile_code = ANY(${codes}::text[]) AND 'boyasiz' = ANY(processed_states) LIMIT 1`,
  ]);
  const colors: string[] = [];
  for (const { color } of [...counted, ...bars] as Array<{ color: string }>) if (!colors.some((c) => sameText(c, color))) colors.push(color);
  if (unpainted.length && !colors.some((c) => sameText(c, UNPAINTED))) colors.push(UNPAINTED);
  return colors.sort((a, b) => a.localeCompare(b, 'tr-TR'));
}

function requireQuoteEditor(actor: WorkOrderActor) {
  if (!canEditQuotation(actor.role)) fail('Teklif hazırlama yetkisi gerekli', 403);
}

/** What the configurator offers for a family: its published recipes, colours, and whether a price matrix exists. */
export async function configurationOptions(actor: WorkOrderActor, familyKey: string) {
  requireQuoteEditor(actor);
  const family = productFamily(familyKey) ?? fail('Bilinmeyen ürün ailesi');
  const available = await familyRecipesAvailable();
  const [recipes, colors, matrix] = await Promise.all([
    available
      ? sql`SELECT DISTINCT ON (r.code) r.id, r.code, r.name, r.version, r.parameter_definitions, r.limits
          FROM product_family_recipes m JOIN production_recipes r ON r.tenant_id = m.tenant_id AND r.code = m.recipe_code
          WHERE m.tenant_id = ${actor.tenantId} AND m.family = ${family.key} AND r.status = 'published' ORDER BY r.code, r.version DESC`
      : [],
    familyColors(sql, actor.tenantId, family),
    activeMatrix(sql, actor.tenantId, family.key),
  ]);
  return {
    family: { key: family.key, label: family.label, dimensions: family.dimensions },
    recipes: recipes.map((r: any) => ({ id: r.id, code: r.code, name: r.name, version: r.version, parameters: r.parameter_definitions ?? [], limits: r.limits })),
    colors,
    matrix: matrix ? { currency: matrix.currency } : null,
  };
}

/**
 * Builds a configured product from the seller's choice: the bill of materials and cut list from the
 * published recipe, and the unit price from the firm's matrix, or the reason it has none (then the
 * seller types the price and the line says so).
 */
export async function configureProduct(db: any, tenantId: string, currency: string, raw: unknown, memo = new Map<string, Promise<any>>()): Promise<ProductConfiguration> {
  const choice: ConfigurationChoice = ConfigurationChoiceSchema.parse(raw);
  const family = productFamily(choice.family) ?? fail('Bilinmeyen ürün ailesi');
  if (!(await familyRecipesAvailable())) fail('Ürün reçeteleri bu kurulumda henüz etkin değil (veritabanı güncellemesi bekleniyor)', 409);
  const [row] = await db`
    SELECT r.* FROM production_recipes r JOIN product_family_recipes m ON m.tenant_id = r.tenant_id AND m.recipe_code = r.code AND m.family = ${family.key}
    WHERE r.tenant_id = ${tenantId} AND r.id = ${choice.recipeId}`;
  if (!row) fail('Reçete bu ürün ailesine ait değil', 409);
  if (row.status !== 'published') fail(`"${row.code}" reçetesi yayında değil; örneklerle doğrulanıp yayınlanmalı`, 409);
  // One quote with several lines of a family reads its colours once.
  if (!memo.has('colors:' + family.key)) memo.set('colors:' + family.key, familyColors(db, tenantId, family));
  const colors: string[] = await memo.get('colors:' + family.key);
  const color = colors.find((c) => sameText(c, choice.color)) ?? fail(`"${choice.color}" rengi sayım listesinde ya da stokta yok`);
  let result: ReturnType<typeof calculateRecipe>;
  try {
    result = calculateRecipe(recipeDefinition(row), { ...choice.parameters, quantity: 1 });
  } catch (error) {
    // Limits, required options and the recipe's own checks speak for themselves.
    throw new WorkOrderApiError(error instanceof Error ? error.message : 'Reçete hesaplanamadı', 400);
  }
  const ids = [...new Set([...result.materials.map((m) => m.itemId), ...result.cuts.map((c) => c.itemId)])];
  const names = new Map<string, { sku: string; name: string }>(
    (await db`SELECT id, sku, name FROM inventory_items WHERE tenant_id = ${tenantId} AND id = ANY(${ids}::uuid[])`).map((i: any) => [i.id, { sku: i.sku, name: i.name }]),
  );
  const label = (id: string) => names.get(id) ?? { sku: '?', name: 'Silinmiş kart' };
  const p = choice.parameters;
  const [a, b] = family.priceAxes.map((k) => p[k]);
  const priced = await quotePrice(db, tenantId, { family: family.key, variant: row.code, a, b, options: { motor: p.motor, led: p.led, ...p.customParameters } });
  let state: PriceState;
  let message: string | null = null;
  if (priced.status === 'no_matrix') [state, message] = ['no_matrix', priced.message];
  else if (priced.status === 'not_covered') [state, message] = ['not_covered', priced.message];
  else if (priced.currency !== currency) [state, message] = ['currency_mismatch', `Fiyat matrisi ${priced.currency}, teklif ${currency}; fiyat çevrilmez`];
  else if (priced.unpricedOptions.length) [state, message] = ['unpriced_options', `Matriste fiyatı olmayan seçenek: ${priced.unpricedOptions.join(', ')}`];
  else state = 'matrix';
  return {
    ...choice,
    color,
    familyLabel: family.label,
    recipe: { code: row.code, name: row.name, version: row.version },
    bom: {
      materials: result.materials.map((m) => ({ ...m, ...label(m.itemId) })),
      cuts: result.cuts.map((c) => ({ ...c, ...label(c.itemId) })),
    },
    price: {
      state,
      source: state === 'matrix' ? 'matrix' : 'manual',
      message,
      matrixId: priced.status === 'priced' ? priced.matrixId : null,
      matrixUnitPrice: state === 'matrix' && priced.status === 'priced' ? priced.unitPrice : null,
      currency,
      lines: priced.status === 'priced' ? priced.lines.map((l) => ({ label: l.label, amount: l.amount })) : [],
    },
  };
}

/** The preview the configurator shows before the line is added; the same calculation runs again on save. */
export async function previewConfiguration(actor: WorkOrderActor, raw: { currency?: unknown; choice?: unknown }) {
  requireQuoteEditor(actor);
  const currency = typeof raw?.currency === 'string' ? raw.currency : 'TRY';
  return configureProduct(sql, actor.tenantId, currency, raw?.choice);
}
