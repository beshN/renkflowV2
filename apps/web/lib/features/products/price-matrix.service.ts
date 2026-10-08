import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { recordAudit } from '@/lib/audit/audit-log';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { PRODUCT_FAMILIES, productFamily } from './families';
import { tableExists } from '@/lib/db/schema-guard';
import { PRICE_MATRIX_IMPORT_ROLES, PRICE_MATRIX_READ_ROLES, priceFromMatrix, readMatrixCsv, type PriceMatrix, type PriceResult } from './price-matrix';

const fail = (message: string, status = 400): never => {
  throw new WorkOrderApiError(message, status);
};

export const MAX_MATRIX_CSV_CHARS = 1_000_000;
/** The matrix table exists only after migration 034; until then quotes say no matrix is defined. */
export const priceMatricesAvailable = () => tableExists('price_matrices');

export function requirePriceMatrixRead(actor: WorkOrderActor) {
  if (!PRICE_MATRIX_READ_ROLES.includes(actor.role)) fail('Fiyat matrisine erişim yok', 403);
}

/** The active matrix of a family, or null when the firm has not imported one. */
export async function activeMatrix(db: any, tenantId: string, family: string): Promise<(PriceMatrix & { id: string }) | null> {
  if (!(await priceMatricesAvailable())) return null;
  const [row] = await db`SELECT id, family, currency, base_rows, option_rows FROM price_matrices WHERE tenant_id = ${tenantId} AND family = ${family} AND status = 'active'`;
  return row ? { id: row.id, family: row.family, currency: row.currency, base: row.base_rows, options: row.option_rows } : null;
}

export type QuotePrice = (PriceResult & { matrixId: string }) | { status: 'no_matrix'; message: string };

/** The price of one configured product, or why there is none; the quote then takes a price by hand. */
export async function quotePrice(
  db: any,
  tenantId: string,
  input: { family: string; variant: string; a: number; b: number; options: Record<string, number | boolean> },
): Promise<QuotePrice> {
  const matrix = await activeMatrix(db, tenantId, input.family);
  if (!matrix) return { status: 'no_matrix', message: 'Fiyat matrisi tanımlı değil' };
  return { ...priceFromMatrix(matrix, input), matrixId: matrix.id };
}

export async function priceMatrixOverview(actor: WorkOrderActor) {
  requirePriceMatrixRead(actor);
  const available = await priceMatricesAvailable();
  const summary = (where: any) => sql`
    SELECT m.id, m.family, m.currency, m.status, m.file_name, jsonb_array_length(m.base_rows) AS base_count, jsonb_array_length(m.option_rows) AS option_count,
      m.created_at, m.archived_at, u.name AS imported_by_name
    FROM price_matrices m LEFT JOIN users u ON u.id = m.imported_by
    WHERE m.tenant_id = ${actor.tenantId} ${where} ORDER BY m.created_at DESC LIMIT 50`;
  // The active matrix of each family is read on its own, not looked for in the recent history.
  const [active, history] = available ? await Promise.all([summary(sql`AND m.status = 'active'`), summary(sql``)]) : [[], []];
  return {
    available,
    canImport: PRICE_MATRIX_IMPORT_ROLES.includes(actor.role),
    families: PRODUCT_FAMILIES.map((f) => ({ key: f.key, label: f.label, active: active.find((r: any) => r.family === f.key) ?? null })),
    history,
  };
}

const ImportSchema = z.object({
  family: z.string().max(40),
  fileName: z.string().trim().max(200).default('fiyat-matrisi.csv'),
  text: z.string().min(1, 'Dosya boş').max(MAX_MATRIX_CSV_CHARS, 'Dosya en fazla 1 MB olabilir'),
  dryRun: z.boolean().default(true),
});

/**
 * Reads the firm's filled template. With dryRun it only reports what it read (or every problem);
 * otherwise it makes it the family's active matrix and keeps the previous one archived.
 */
export async function importPriceMatrix(actor: WorkOrderActor, raw: unknown) {
  if (!PRICE_MATRIX_IMPORT_ROLES.includes(actor.role)) fail('Fiyat matrisini firma yöneticisi yükler', 403);
  const input = ImportSchema.parse(raw);
  if (!productFamily(input.family)) fail('Bilinmeyen ürün ailesi');
  const read = readMatrixCsv(input.text, input.family);
  if (!read.ok) return { ok: false as const, errors: read.errors };
  const summary = { family: read.matrix.family, currency: read.matrix.currency, base: read.matrix.base.length, options: read.matrix.options.length };
  if (input.dryRun) return { ok: true as const, dryRun: true, summary, matrix: read.matrix };
  if (!(await priceMatricesAvailable())) fail('Bu kurulumda fiyat matrisi henüz etkin değil (veritabanı güncellemesi bekleniyor)', 409);
  const sha = createHash('sha256').update(input.text).digest('hex');
  return withTransaction(async (tx: any) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${actor.tenantId + ':price-matrix:' + input.family}, 0))`;
    const previous = await tx`UPDATE price_matrices SET status = 'archived', archived_at = now()
      WHERE tenant_id = ${actor.tenantId} AND family = ${input.family} AND status = 'active' RETURNING id`;
    const [row] = await tx`
      INSERT INTO price_matrices (tenant_id, family, currency, status, file_name, file_sha256, base_rows, option_rows, imported_by)
      VALUES (${actor.tenantId}, ${input.family}, ${read.matrix.currency}, 'active', ${input.fileName}, ${sha},
        ${JSON.stringify(read.matrix.base)}::text::jsonb, ${JSON.stringify(read.matrix.options)}::text::jsonb, ${actor.userId})
      RETURNING id`;
    await recordAudit(tx, {
      tenantId: actor.tenantId,
      actorId: actor.userId,
      entityType: 'price_matrix',
      entityId: row.id,
      action: 'imported',
      metadata: { ...summary, fileName: input.fileName, sha256: sha, replaced: previous[0]?.id ?? null },
    });
    return { ok: true as const, dryRun: false, summary, id: row.id as string };
  });
}

const CheckSchema = z.object({
  family: z.string().max(40),
  variant: z.string().trim().max(60).default('*'),
  a: z.number({ message: 'En sayı olmalı' }).int('En tam sayı (mm) olmalı').positive('En pozitif olmalı').max(100000),
  b: z.number({ message: 'Açılım sayı olmalı' }).int('Açılım tam sayı (mm) olmalı').positive('Açılım pozitif olmalı').max(100000),
  options: z.record(z.string().max(60), z.union([z.number().finite(), z.boolean()])).default({}),
});

/** Tries the active matrix on a measure, to check an import before quoting with it. */
export async function checkPrice(actor: WorkOrderActor, raw: unknown) {
  requirePriceMatrixRead(actor);
  const input = CheckSchema.parse(raw);
  if (!productFamily(input.family)) fail('Bilinmeyen ürün ailesi');
  return quotePrice(sql, actor.tenantId, input);
}
