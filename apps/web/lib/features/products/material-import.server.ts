import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { sql } from '@/lib/db';
import { recordAudit } from '@/lib/audit/audit-log';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { ImportInput, type ImportResultRow } from '@/lib/features/imports/contacts.server';
import { productionCommandInTransaction } from '@/lib/features/manufacturing/platform.service';
import { foldSql, foldText } from '@/lib/shared/text/fold';
import { normalizeStates } from '@/lib/features/inventory/vocabulary';
import type { MaterialInput } from '@/lib/features/inventory/material-contract';
import { parseMaterialCsv, materialIdentity, MATERIAL_IMPORT_LABELS } from './material-import';

const fail = (message: string, status = 400): never => { throw new WorkOrderApiError(message, status); };
const dataOf = (card: any): MaterialInput => ({
  sku: card.sku, name: card.name, itemType: card.item_type, uom: card.stock_uom,
  standardLengthMm: Number(card.standard_length_m ?? 0) * 1000,
  weightPerMeterKg: Number(card.weight_per_meter_kg ?? 0), minStock: Number(card.min_stock ?? 0),
  profileCode: card.profile_code ?? null, sizeLabel: card.size_label ?? null,
  processedStates: normalizeStates(card.processed_states ?? []), pieceLengthMm: card.piece_length_mm ?? null,
});
/** Creates cards only; stock balances and physical lots require their own controlled entries. */
export async function importMaterialCards(actor: WorkOrderActor, raw: unknown) {
  if (!['owner', 'admin'].includes(actor.role)) fail('Ürün kartını firma yöneticisi aktarabilir', 403);
  const input = ImportInput.parse(raw);
  if (input.fillEmpty || input.includeNameMatches) fail('Ürün aktarımı mevcut kartları değiştirmez; seçenekleri kapatın');
  let parsed;
  try { parsed = parseMaterialCsv(input.text); }
  catch (e) { fail(e instanceof Error ? e.message : 'CSV okunamadı'); }
  const { rows, columns } = parsed!;
  return sql.begin(async (tx: any) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${actor.tenantId}, 0))`;
    const skus = [...new Set(rows.flatMap((r) => r.data ? [foldText(r.data.sku)] : []))];
    const profiles = [...new Set(rows.flatMap((r) => r.data?.profileCode ? [foldText(r.data.profileCode)] : []))];
    const cards = await tx`SELECT id, sku, name, item_type, stock_uom, standard_length_m, weight_per_meter_kg, min_stock, profile_code, size_label, processed_states, piece_length_mm, active
      FROM inventory_items WHERE tenant_id=${actor.tenantId} AND (${foldSql(tx, tx`sku`)}=ANY(${skus}::text[]) OR ${foldSql(tx, tx`profile_code`)}=ANY(${profiles}::text[])) ORDER BY id LIMIT 10001 FOR UPDATE`;
    if (cards.length > 10000) fail('Çok fazla aday kart var; stok kartlarını inceleyin', 413);
    const previewHash = createHash('sha256').update(JSON.stringify({ tenant: actor.tenantId, user: actor.userId, text: input.text, cards })).digest('hex');
    if (!input.dryRun && input.previewHash !== previewHash) fail('Ürün önizlemesi değişti veya eksik. Dosyayı yeniden önizleyin.', 409);
    const results: ImportResultRow[] = [];
    const summary = { new: 0, exists: 0, filled: 0, nameMatches: 0, errors: 0 };
    for (const row of rows) {
      const result: ImportResultRow = { line: row.line, name: row.name, outcome: 'error' };
      const errors = [...row.errors];
      const d = row.data;
      let match: any;
      if (d && !errors.length) {
        const identity = materialIdentity(d);
        const matches = cards.filter((card: any) => foldText(card.sku) === foldText(d.sku) || (identity && materialIdentity(dataOf(card)) === identity));
        if (matches.length > 1) errors.push('Stok kodu/profil kimliği birden fazla kartla eşleşiyor');
        else if (matches.length) {
          match = matches[0];
          if (!match.active) errors.push('Kart arşivli; aktarım kartı etkinleştirmez');
          const existing = dataOf(match);
          const changed = (Object.keys(MATERIAL_IMPORT_LABELS) as Array<keyof MaterialInput>).filter((key) => JSON.stringify(existing[key]) !== JSON.stringify(d[key]));
          if (changed.length) errors.push(`Kayıtlı kartın bilgileri farklı: ${changed.map((key) => MATERIAL_IMPORT_LABELS[key]).join(', ')}. Mevcut kart korunur.`);
        }
      }
      if (errors.length || !d) {
        result.errors = errors.length ? errors : ['Kart okunamadı'];
        summary.errors++;
      } else if (match) {
        result.outcome = 'exists'; result.matchedId = match.id; summary.exists++;
      } else {
        result.outcome = 'new'; summary.new++;
        if (!input.dryRun) {
          const saved = await productionCommandInTransaction(tx, actor, { commandId: randomUUID(), action: 'material.save', data: d });
          result.matchedId = saved.id;
          await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'inventory_item', entityId: saved.id, action: 'imported', metadata: { line: row.line, sku: d.sku } });
        }
      }
      results.push(result);
    }
    if (!input.dryRun) await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'inventory_import', entityId: actor.tenantId, action: 'imported', metadata: summary });
    return { dryRun: input.dryRun, previewHash, columns, ignored: [], summary, rows: results };
  });
}
