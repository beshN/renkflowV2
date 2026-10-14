import 'server-only';

import { z } from 'zod';

import { recordAudit } from '@/lib/audit/audit-log';
import { columnExists } from '@/lib/db/schema-guard';
import { foldText } from '@/lib/shared/text/fold';
import { identityKeys, parseCustomerImport, type CustomerImportFields } from './import';

// Writes a parsed customer list. The server parses the file itself (the browser preview is only a
// preview) and matches every row against the firm's cards under the same lock the order flow uses
// to open cards, so an import never creates a second card for a known customer.

type Db = any;
type Row = Record<string, any>;

export type ImportOutcome = 'new' | 'exists' | 'fill' | 'name_match' | 'error';
export type ImportResultRow = { line: number; name: string; outcome: ImportOutcome; matchedId?: string; filled?: string[]; errors?: string[] };

export const ImportInput = z.object({
  text: z.string().min(1).max(2_000_000),
  dryRun: z.boolean().default(true),
  /** Fill a matched card's empty fields from the file (never overwrites). */
  fillEmpty: z.boolean().default(false),
  /** Rows that only share a name with a card are skipped unless this is set. */
  includeNameMatches: z.boolean().default(false),
}).strict();

const COLUMNS: Record<keyof CustomerImportFields, string> = {
  fullName: 'full_name', companyName: 'company_name', phone: 'phone', email: 'email', taxNumber: 'tax_number', taxOffice: 'tax_office',
  address: 'address', city: 'city', district: 'district', notes: 'notes',
};
const FILLABLE: (keyof CustomerImportFields)[] = ['companyName', 'phone', 'email', 'taxNumber', 'taxOffice', 'address', 'city', 'district', 'notes'];

async function cards(db: Db, tenantId: string) {
  const rows: Row[] = await db`
    SELECT id, full_name, company_name, tax_number, lower(email) AS email, right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10) AS phone_key, to_jsonb(customers) AS raw
    FROM customers WHERE tenant_id = ${tenantId} AND is_active = true`;
  const byTax = new Map<string, Row>();
  const byEmail = new Map<string, Row>();
  const byPhone = new Map<string, Row>();
  const byName = new Map<string, Row>();
  for (const c of rows) {
    if (c.tax_number) byTax.set(String(c.tax_number), c);
    if (c.email) byEmail.set(c.email, c);
    if (c.phone_key?.length === 10) byPhone.set(c.phone_key, c);
    byName.set(foldText(c.full_name ?? ''), c);
    if (c.company_name) byName.set(foldText(c.company_name), c);
  }
  return { byTax, byEmail, byPhone, byName };
}

export async function importCustomers(db: Db, actor: { tenantId: string; userId: string }, raw: unknown) {
  const input = ImportInput.parse(raw);
  const parsed = parseCustomerImport(input.text);
  const hasCity = await columnExists('customers', 'city');

  const run = async (tx: Db) => {
    const known = await cards(tx, actor.tenantId);
    const results: ImportResultRow[] = [];
    const created: string[] = [];
    let filledCount = 0;
    for (const row of parsed.rows) {
      const name = row.data.fullName || row.data.companyName || '';
      if (row.errors.length) { results.push({ line: row.line, name, outcome: 'error', errors: row.errors }); continue; }
      const ids = identityKeys(row.data);
      const match = (ids.tax && known.byTax.get(ids.tax)) || (ids.email && known.byEmail.get(ids.email)) || (ids.phone && known.byPhone.get(ids.phone));
      if (match) {
        const current = match.raw as Row;
        const filled = FILLABLE.filter((f) => row.data[f] && !current[COLUMNS[f]] && (hasCity || (f !== 'city' && f !== 'district')));
        if (input.fillEmpty && filled.length) {
          if (!input.dryRun) {
            for (const f of filled) await tx`UPDATE customers SET ${tx(COLUMNS[f])} = coalesce(${tx(COLUMNS[f])}, ${row.data[f]}), updated_at = now() WHERE id = ${match.id}`;
            await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'customer', entityId: match.id, action: 'field_updated', metadata: { source: 'import', fields: filled.map((f) => COLUMNS[f]) } });
          }
          filledCount++;
          results.push({ line: row.line, name, outcome: 'fill', matchedId: String(match.id), filled: filled.map((f) => COLUMNS[f]) });
        } else {
          results.push({ line: row.line, name, outcome: 'exists', matchedId: String(match.id) });
        }
        continue;
      }
      const named = known.byName.get(ids.name);
      if (named && !input.includeNameMatches) { results.push({ line: row.line, name, outcome: 'name_match', matchedId: String(named.id) }); continue; }
      if (!input.dryRun) {
        const d = row.data;
        const [c] = await tx`
          INSERT INTO customers (tenant_id, full_name, company_name, email, phone, address, tax_number, tax_office, notes)
          VALUES (${actor.tenantId}, ${d.fullName}, ${d.companyName}, ${d.email}, ${d.phone}, ${d.address}, ${d.taxNumber}, ${d.taxOffice}, ${d.notes})
          RETURNING id`;
        if (hasCity && (d.city || d.district)) await tx`UPDATE customers SET city = ${d.city}, district = ${d.district} WHERE id = ${c.id}`;
        await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'customer', entityId: c.id, action: 'created', metadata: { source: 'import' } });
        created.push(String(c.id));
        // Later rows of the same file match the new card.
        const card = { id: c.id, full_name: d.fullName, company_name: d.companyName, raw: { ...d } };
        if (ids.tax) known.byTax.set(ids.tax, card);
        if (ids.email) known.byEmail.set(ids.email, card);
        if (ids.phone) known.byPhone.set(ids.phone, card);
        known.byName.set(ids.name, card);
      }
      results.push({ line: row.line, name, outcome: 'new' });
    }
    const summary = {
      new: results.filter((r) => r.outcome === 'new').length,
      exists: results.filter((r) => r.outcome === 'exists').length,
      filled: filledCount,
      nameMatches: results.filter((r) => r.outcome === 'name_match').length,
      errors: results.filter((r) => r.outcome === 'error').length,
    };
    if (!input.dryRun) {
      await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'tenant', entityId: actor.tenantId, action: 'customers_imported', metadata: summary });
    }
    return { dryRun: input.dryRun, columns: parsed.columns, ignored: parsed.ignored, summary, rows: results };
  };

  if (input.dryRun) return run(db);
  return db.begin(async (tx: Db) => {
    // The same lock the order flow takes before opening a card.
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${actor.tenantId + ':customer-create'}, 0))`;
    return run(tx);
  });
}
