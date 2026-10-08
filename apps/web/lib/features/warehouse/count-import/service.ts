import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { postStockEntryInTransaction } from '@/lib/features/manufacturing/inventory.service';
import { pdfTextItems } from './extract';
import { parseCountDocument, type CountRow } from './parse';
import { itemIdentity, rowStates } from './identity';

export { itemIdentity, rowStates };

export const COUNT_IMPORT_KIND = 'stock.count_import';
type Status = 'applied' | 'needs_bars' | 'uncertain' | 'skipped';
/** Hosting accepts about 4.5 MB per request; base64 adds a third, so files up to 3 MB. */
export const MAX_COUNT_PDF_BYTES = 3_000_000;
const MAX_BYTES = MAX_COUNT_PDF_BYTES;
/** Approval writes each row inside one transaction; a count list is far shorter than this. */
const MAX_ROWS = 500;

const fail = (message: string, status = 400): never => {
  throw new WorkOrderApiError(message, status);
};

export const CountRowSchema = z.object({
  ref: z.string().max(40),
  page: z.number().int().positive(),
  section: z.string().max(200),
  code: z.string().max(40).nullable(),
  name: z.string().max(300),
  size: z.string().max(40).nullable(),
  color: z.string().max(100).nullable(),
  states: z.array(z.enum(['boyali', 'boyasiz', 'hazir', 'delikli', 'galvanizli'])).max(5),
  quantity: z.number().finite().nullable(),
  unit: z.enum(['m', 'adet', 'takim', 'boy']).nullable(),
  pieceLengthMm: z.number().int().positive().nullable(),
  weightPerMeterKg: z.number().finite().nullable(),
  weightKg: z.number().finite().nullable(),
  detail: z.string().max(300).nullable(),
  issues: z.array(z.string().max(500)).max(20),
  unplaced: z.array(z.string().max(300)).max(20),
});

export const CountImportPayloadSchema = z.object({
  document: z.object({
    title: z.string().max(200).nullable(),
    date: z.string().regex(/^\d{2}\.\d{2}\.\d{4}$/).nullable(),
    pages: z.number().int().nonnegative(),
    sha256: z.string().length(64),
    fileName: z.string().max(200),
  }),
  warehouseId: z.string().uuid(),
  rows: z.array(CountRowSchema).min(1).max(MAX_ROWS),
});
export type CountImportPayload = z.infer<typeof CountImportPayloadSchema>;

const UploadSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  base64: z.string().min(8).max(Math.ceil((MAX_BYTES * 4) / 3) + 8),
  warehouseId: z.string().uuid(),
});

function manager(actor: WorkOrderActor) {
  if (!['owner', 'admin'].includes(actor.role)) fail('Sayım listesini firma yöneticisi içe aktarabilir', 403);
}

/** Reads the PDF, checks it, and files it as a suggestion. Nothing is written to stock here. */
export async function fileCountImport(actor: WorkOrderActor, raw: unknown) {
  manager(actor);
  const input = UploadSchema.parse(raw);
  const bytes = Buffer.from(input.base64, 'base64');
  if (bytes.length > MAX_BYTES) fail('Dosya en fazla 3 MB olabilir', 413);
  if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') fail('PDF dosyası seçin');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const [warehouse] = await sql`SELECT id, name FROM warehouses WHERE tenant_id = ${actor.tenantId} AND id = ${input.warehouseId} AND warehouse_type = 'RAW' AND active = true`;
  if (!warehouse) fail('Geçerli bir hammadde deposu seçin');
  if ((await sql`SELECT 1 FROM stock_count_documents WHERE tenant_id = ${actor.tenantId} AND file_sha256 = ${sha256}`).length)
    fail('Bu sayım listesi daha önce içe aktarıldı', 409);
  let parsed;
  try {
    parsed = parseCountDocument(await pdfTextItems(new Uint8Array(bytes)));
  } catch (error) {
    if (!(error instanceof Error && /en fazla/.test(error.message))) console.error('[count import] PDF read failed:', error instanceof Error ? error.message : error);
    fail(error instanceof Error && /en fazla/.test(error.message) ? error.message : 'PDF okunamadı');
  }
  const document = parsed!;
  if (!document.rows.length)
    fail('PDF\'te sayım tablosu bulunamadı. Taranmış (resim) PDF okunamaz; metin içeren sayım listesi gerekli.');
  const rows = document.rows;
  if (rows.length > MAX_ROWS) fail(`Bir sayım listesi en fazla ${MAX_ROWS} satır olabilir; listeyi bölerek yükleyin`);
  const uncertain = rows.filter((r) => r.issues.length);
  const metres = rows.filter((r) => !r.issues.length && (r.unit === 'm' || r.unit === 'boy'));
  const counted = rows.filter((r) => !r.issues.length && (r.unit === 'adet' || r.unit === 'takim'));
  const payload: CountImportPayload = {
    document: { title: document.title, date: document.date, pages: document.pages, sha256, fileName: input.fileName },
    warehouseId: warehouse.id,
    rows,
  };
  const { fileSuggestion } = await import('@/lib/ai/suggestions/service');
  const note = uncertain.length
    ? `${uncertain.length} satır emin değilim, uygulanmayacak: ` +
      uncertain.slice(0, 8).map((r) => `${r.name || r.ref} (${r.issues[0]})`).join('; ') +
      (uncertain.length > 8 ? `; ve ${uncertain.length - 8} satır daha` : '')
    : null;
  const filed = await fileSuggestion(sql, actor.tenantId, actor.userId, {
    kind: COUNT_IMPORT_KIND,
    title: `Sayım listesi${document.date ? ' ' + document.date : ''}: ${rows.length} satır${uncertain.length ? `, ${uncertain.length} emin değilim` : ''}`,
    rationale: [
      `"${input.fileName}" (${document.pages} sayfa) kesin kurallarla okundu; model kullanılmadı.`,
      `${counted.length} adet/takım satırı ${warehouse.name} deposuna açılış stoğu olarak yazılır (yalnız mevcut stoktan fazlası).`,
      `${metres.length} metre/boy satırı stok kartı olarak açılır; çubukların boy ve adedi açılış sayımı ekranında girilir, PDF'teki toplam karşılaştırma için tutulur.`,
      'Malzeme kartı: profil kodu + ölçü + işlenmiş hâl; renk çubukta tutulur. Onaylanmadan hiçbir stok yazılmaz.',
    ].join('\n'),
    payload,
    affected: [],
    uncertain: uncertain.length > 0,
    uncertaintyNote: note ? note.slice(0, 1000) : null,
    source: 'system',
    dedupeKey: `${sha256}:${warehouse.id}`,
  });
  return {
    suggestionId: filed.suggestion.id as string,
    created: filed.created,
    document: payload.document,
    summary: { rows: rows.length, counted: counted.length, metres: metres.length, uncertain: uncertain.length },
    rows,
  };
}

async function resolveItem(tx: any, tenantId: string, row: CountRow) {
  const identity = itemIdentity(row);
  const unit = row.unit === 'boy' ? 'm' : row.unit!;
  const [existing] = row.code
    ? await tx`SELECT * FROM inventory_items WHERE tenant_id = ${tenantId} AND lower(profile_code) = lower(${row.code}) AND lower(coalesce(size_label, '')) = lower(${row.size ?? ''}) AND processed_states = ${identity.states}::text[] AND coalesce(piece_length_mm, 0) = ${row.pieceLengthMm ?? 0} LIMIT 1`
    : await tx`SELECT * FROM inventory_items WHERE tenant_id = ${tenantId} AND sku = ${identity.sku} LIMIT 1`;
  if (existing) {
    // An archived card is not reused silently, and a second one cannot be made beside it.
    if (!existing.active) return { item: null, note: `Bu kalemin kartı (${existing.sku}) pasif; önce kartı etkinleştirin` };
    if (existing.stock_uom !== unit) return { item: null, note: `Mevcut kartın birimi ${existing.stock_uom}, listede ${unit}` };
    return { item: existing, note: null };
  }
  let sku = identity.sku;
  for (let n = 2; (await tx`SELECT 1 FROM inventory_items WHERE tenant_id = ${tenantId} AND sku = ${sku}`).length; n++) sku = `${identity.sku}-${n}`;
  const [item] = await tx`
    INSERT INTO inventory_items (tenant_id, sku, name, unit, item_type, stock_uom, weight_per_meter_kg, min_stock, profile_code, size_label, processed_states, piece_length_mm, metadata)
    VALUES (${tenantId}, ${sku}, ${identity.name}, ${unit}, ${unit === 'm' ? 'raw_material' : 'consumable'}, ${unit},
      ${unit === 'm' ? row.weightPerMeterKg : null}, 0, ${row.code}, ${row.size}, ${identity.states}::text[], ${row.pieceLengthMm},
      ${JSON.stringify({ source: 'count_import', section: row.section })}::text::jsonb)
    RETURNING *`;
  return { item, note: null };
}

/**
 * Approving the import: cards are created, counted pieces get their opening stock (only what is
 * above current stock, so the same list cannot be added twice), metre rows wait for the bar count,
 * uncertain rows are kept but not applied.
 */
export async function applyCountImport(tx: any, actor: WorkOrderActor, payload: CountImportPayload, suggestionId: string) {
  manager(actor);
  const t = actor.tenantId;
  const [warehouse] = await tx`SELECT id FROM warehouses WHERE tenant_id = ${t} AND id = ${payload.warehouseId} AND warehouse_type = 'RAW' AND active = true`;
  if (!warehouse) fail('Sayım deposu artık kullanılamıyor', 409);
  const [taken] = await tx`SELECT id FROM stock_count_documents WHERE tenant_id = ${t} AND file_sha256 = ${payload.document.sha256}`;
  if (taken) fail('Bu sayım listesi daha önce içe aktarıldı', 409);
  const [d, m, y] = (payload.document.date ?? '').split('.');
  const [doc] = await tx`
    INSERT INTO stock_count_documents (tenant_id, title, count_date, file_name, file_sha256, warehouse_id, suggestion_id, created_by)
    VALUES (${t}, ${payload.document.title}, ${payload.document.date ? `${y}-${m}-${d}` : null}, ${payload.document.fileName}, ${payload.document.sha256}, ${warehouse.id}, ${suggestionId}, ${actor.userId})
    RETURNING id`;
  const tally = { applied: 0, needsBars: 0, uncertain: 0, skipped: 0 };
  // 1. Each row gets its card (or the reason it has none).
  const rows = [];
  for (const row of payload.rows) {
    if (row.issues.length) {
      rows.push({ row, item: null as any, status: 'uncertain' as Status, note: null as string | null });
      continue;
    }
    const resolved = await resolveItem(tx, t, row);
    if (!resolved.item) rows.push({ row, item: null, status: 'skipped' as Status, note: resolved.note });
    else rows.push({ row, item: resolved.item, status: (row.unit === 'm' || row.unit === 'boy' ? 'needs_bars' : 'applied') as Status, note: null });
  }
  // 2. Counted pieces: rows that are the same card (e.g. two colours of one accessory) are added up,
  //    and only the counted total above current stock is written, so a list never counts twice.
  const lines: any[] = [];
  const byItem = new Map<string, typeof rows>();
  for (const r of rows) if (r.status === 'applied') byItem.set(r.item.id, [...(byItem.get(r.item.id) ?? []), r]);
  for (const [itemId, group] of byItem) {
    const counted = group.reduce((sum, r) => sum + Number(r.row.quantity), 0);
    const [balance] = await tx`SELECT on_hand_qty FROM stock_balances WHERE tenant_id = ${t} AND item_id = ${itemId} AND warehouse_id = ${warehouse.id}`;
    const delta = counted - Number(balance?.on_hand_qty ?? 0);
    if (delta < 0) {
      for (const r of group) {
        r.status = 'skipped';
        r.note = `Sayılan toplam (${counted}) mevcut stoktan az; fark elle incelenmeli`;
      }
      continue;
    }
    if (delta === 0) continue;
    const [lot] = await tx`
      INSERT INTO stock_lots (tenant_id, item_id, warehouse_id, lot_number, original_qty, remaining_qty, metadata)
      VALUES (${t}, ${itemId}, ${warehouse.id}, ${`SAYIM-${String(doc.id).slice(0, 8).toUpperCase()}-${lines.length + 1}`}, ${delta}, ${delta},
        ${JSON.stringify({ source: 'opening_count', documentId: doc.id })}::text::jsonb)
      RETURNING id`;
    lines.push({ itemId, warehouseId: warehouse.id, lotId: lot.id, quantityDelta: delta, uom: group[0].row.unit!, metadata: { countLines: group.map((r) => r.row.ref) } });
  }
  for (const { row, item, status, note } of rows) {
    tally[status === 'needs_bars' ? 'needsBars' : status]++;
    await tx`
      INSERT INTO stock_count_lines (tenant_id, document_id, ref, section, code, name, size_label, color, processed_states, quantity, unit, piece_length_mm, weight_per_meter_kg, weight_kg, issues, item_id, status, note)
      VALUES (${t}, ${doc.id}, ${row.ref}, ${row.section}, ${row.code}, ${row.name}, ${row.size}, ${row.color}, ${rowStates(row)}::text[], ${row.quantity}, ${row.unit},
        ${row.pieceLengthMm}, ${row.weightPerMeterKg}, ${row.weightKg}, ${JSON.stringify(row.issues)}::text::jsonb, ${item?.id ?? null}, ${status}, ${note})`;
  }
  let entryId: string | null = null;
  if (lines.length) {
    // A receipt, not a reconciliation: a wrongly approved count can be reversed while its lots are untouched.
    const entry = await postStockEntryInTransaction(tx, actor, {
      entryType: 'MATERIAL_RECEIPT',
      idempotencyKey: `count-import:${doc.id}`,
      referenceType: 'opening_count',
      referenceId: doc.id,
      note: `Açılış sayımı: ${payload.document.title ?? payload.document.fileName}${payload.document.date ? ' ' + payload.document.date : ''}`,
      lines,
    });
    entryId = entry.id;
    await tx`UPDATE stock_count_documents SET stock_entry_id = ${entry.id} WHERE id = ${doc.id}`;
  }
  return { documentId: doc.id as string, entryId, ...tally, href: `/inventory/count-import?document=${doc.id}` };
}

/** Imported documents with their lines, newest first. */
export async function countImports(actor: WorkOrderActor) {
  if (!['owner', 'admin', 'office'].includes(actor.role)) fail('Sayım kayıtlarına erişim yok', 403);
  const documents = await sql`
    SELECT d.id, d.title, d.count_date, d.file_name, d.created_at, d.stock_entry_id, w.name AS warehouse_name,
      (SELECT json_agg(json_build_object('id', l.id, 'ref', l.ref, 'section', l.section, 'code', l.code, 'name', l.name, 'color', l.color,
        'quantity', l.quantity, 'unit', l.unit, 'pieceLengthMm', l.piece_length_mm, 'issues', l.issues, 'status', l.status, 'note', l.note, 'itemId', l.item_id)
        ORDER BY l.created_at, l.ref) FROM stock_count_lines l WHERE l.document_id = d.id) AS lines
    FROM stock_count_documents d JOIN warehouses w ON w.id = d.warehouse_id AND w.tenant_id = d.tenant_id
    WHERE d.tenant_id = ${actor.tenantId}
    ORDER BY d.created_at DESC
    LIMIT 20`;
  return documents;
}
