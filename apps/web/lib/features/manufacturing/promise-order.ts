import { RecipeSchema, RecipeParametersSchema, calculateRecipe } from './recipe-engine';

/** Procurement dates become 08:00 Europe/Istanbul (UTC+03:00).
 * Availability boundary only: actual center shifts are still applied by the scheduler. */
export function materialReadyAt(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day)
    throw new Error('Malzeme hazır tarihi geçersiz');
  return `${day}T08:00:00+03:00`;
}

export function promiseLine(item: any, row: any) {
  if (!row || row.status !== 'published') throw new Error('Yayınlı reçete gerekli');
  if (!['adet', 'pcs', 'piece', 'pieces', 'unit'].includes(item.quantity_unit ?? 'adet'))
    throw new Error('Üretim miktar birimi adet olarak doğrulanmalı');
  const recipe = RecipeSchema.parse({ code: row.code, name: row.name, version: row.version,
    finishedItemId: row.finished_item_id, rules: row.rules, operations: row.operations,
    limits: row.limits, examples: row.examples, parameterDefinitions: row.parameter_definitions ?? [],
    constraints: row.constraints ?? [], geometry: row.geometry });
  const pc = item.product_configuration;
  const parameters = RecipeParametersSchema.parse({ ...pc?.parameters, quantity: Number(item.quantity) });
  if (typeof pc?.color !== 'string' || !pc.color.trim()) throw new Error('Onaylı malzeme rengi gerekli');
  return { recipe, parameters, color: pc.color as string, calculated: calculateRecipe(recipe, parameters) };
}
