import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { summarizeImport, type ImportResultRow } from '@/lib/features/import/csv';
import { parseSupplierImport, supplierIdentity, type SupplierImportFields } from './import';

type Db = any;
type Card = SupplierImportFields & { id: string };
export const SupplierImportInput = z.object({ text: z.string().min(1).max(2_000_000), dryRun: z.boolean().default(true), fillEmpty: z.boolean().default(false) }).strict();
const empty = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && !v.trim());

type SupplierImportResult = { dryRun: boolean; columns: Record<string, string>; ignored: string[]; summary: ReturnType<typeof summarizeImport>; rows: ImportResultRow[] };
export async function importSuppliers(db: Db, actor: { tenantId: string; userId: string }, raw: unknown): Promise<SupplierImportResult> {
  const input = SupplierImportInput.parse(raw);
  const parsed = parseSupplierImport(input.text);
  const run = async (tx: Db) => {
    const cards: Card[] = await tx`SELECT * FROM suppliers WHERE tenant_id = ${actor.tenantId} ORDER BY id`;
    const results: ImportResultRow[] = [];
    for (const row of parsed.rows) {
      const { data: d, line, errors } = row;
      if (errors.length) { results.push({ line, name: d.name, outcome: 'error', errors }); continue; }
      const ids = supplierIdentity(d);
      const match = (['tax', 'email', 'phone', 'name'] as const).map(k => ids[k] && cards.find(c => supplierIdentity(c)[k] === ids[k])).find(Boolean) as Card | undefined;
      let changed = false;
      if (match) {
        // A name-only match is always an existing card; it never opens another card or fills it.
        const strong = (['tax', 'email', 'phone'] as const).some(k => ids[k] && supplierIdentity(match)[k] === ids[k]);
        const filled = strong && input.fillEmpty ? (Object.keys(d) as (keyof SupplierImportFields)[]).filter(f => f !== 'name' && !empty(d[f]) && empty(match[f])) : [];
        if (filled.length) {
          for (const f of filled) {
            if (!input.dryRun) await tx`UPDATE suppliers SET ${tx(f)} = ${d[f]}, version = version + 1, updated_at = now() WHERE tenant_id = ${actor.tenantId} AND id = ${match.id}`;
            Object.assign(match, { [f]: d[f] });
          }
          changed = true;
        }
        results.push({ line, name: d.name, outcome: filled.length ? 'fill' : 'exists', ...(match.id.startsWith('preview-') ? {} : { matchedId: match.id }), ...(filled.length ? { filled } : {}) });
      } else {
        let id = `preview-${line}`;
        if (!input.dryRun) {
          const [created] = await tx`INSERT INTO suppliers (tenant_id,name,code,contact_name,phone,email,address,tax_number,tax_office,payment_terms,notes)
            VALUES (${actor.tenantId},${d.name},${d.code},${d.contact_name},${d.phone},${d.email},${d.address},${d.tax_number},${d.tax_office},${d.payment_terms ?? 30},${d.notes}) RETURNING id`;
          id = created.id;
        }
        cards.push({ ...d, payment_terms: d.payment_terms ?? 30, id });
        changed = true;
        results.push({ line, name: d.name, outcome: 'new' });
      }
      // Same activity event as productionCommand(procurement.supplier.save); no new audit vocabulary.
      if (changed && !input.dryRun) await tx`INSERT INTO production_events (tenant_id,work_order_id,operation_id,event_type,payload,actor_id)
        VALUES (${actor.tenantId},NULL,NULL,'procurement.supplier.save',${JSON.stringify({ commandId: randomUUID() })}::text::jsonb,${actor.userId})`;
    }
    return { dryRun: input.dryRun, columns: parsed.columns, ignored: parsed.ignored, summary: summarizeImport(results), rows: results };
  };
  if (input.dryRun) return run(db);
  return db.begin(async (tx: Db) => {
    // Shares the lock used by productionCommand, including normal supplier creation.
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${actor.tenantId},0))`;
    return run(tx);
  });
}
