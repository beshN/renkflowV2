import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { recordAudit } from '@/lib/audit/audit-log';
import { foldSql } from '@/lib/shared/text/fold';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import {
  identityKeys,
  type CustomerImportFields,
  type ParsedCustomerImport,
} from '@/lib/features/customers/import';

type Db = any;
type Card = { id: string; raw: Record<string, any>; virtual?: boolean };
export type ImportOutcome = 'new' | 'exists' | 'fill' | 'name_match' | 'error';
export type ImportResultRow = {
  line: number;
  name: string;
  outcome: ImportOutcome;
  matchedId?: string;
  filled?: string[];
  errors?: string[];
};

export const ImportInput = z
  .object({
    text: z.string().min(1).max(2_000_000),
    dryRun: z.boolean().default(true),
    fillEmpty: z.boolean().default(false),
    includeNameMatches: z.boolean().default(false),
    previewHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .strict();

export type ContactImportConfig = {
  table: 'customers' | 'suppliers';
  entityType: 'customer' | 'supplier';
  columns: Partial<Record<keyof CustomerImportFields, string>>;
  fillable: (keyof CustomerImportFields)[];
  parse: (text: string) => ParsedCustomerImport;
  label: string;
  allowNameDuplicates: boolean;
  displayName: (data: CustomerImportFields) => string;
};
const empty = (value: unknown) =>
  value == null || (typeof value === 'string' && !value.trim());
const fields = (
  card: Card,
  columns: ContactImportConfig['columns'],
): CustomerImportFields =>
  Object.fromEntries(
    Object.entries(columns).map(([f, c]) => [f, card.raw[c!]]),
  ) as CustomerImportFields;

/** Index every matching card; a Map<string, Card> would silently discard ambiguous identifiers. */
function indexCards(cards: Card[], columns: ContactImportConfig['columns']) {
  const indexes = {
    tax: new Map<string, Set<Card>>(),
    email: new Map<string, Set<Card>>(),
    phone: new Map<string, Set<Card>>(),
    name: new Map<string, Set<Card>>(),
  };
  const add = (card: Card) => {
    const keys = identityKeys(fields(card, columns));
    for (const kind of ['tax', 'email', 'phone', 'name'] as const) {
      const key = keys[kind];
      if (!key) continue;
      const matches = indexes[kind].get(key) ?? new Set<Card>();
      matches.add(card);
      indexes[kind].set(key, matches);
    }
    if (
      columns.companyName &&
      columns.fullName &&
      card.raw[columns.companyName] &&
      card.raw[columns.fullName]
    ) {
      const key = identityKeys({
        ...fields(card, columns),
        companyName: null,
      }).name;
      const matches = indexes.name.get(key) ?? new Set<Card>();
      matches.add(card);
      indexes.name.set(key, matches);
    }
  };
  cards.forEach(add);
  return { indexes, add };
}

/** Preview and commit use the same simulation; a changed file, options or cards requires a new preview. */
export async function importContacts(
  db: Db,
  actor: { tenantId: string; userId: string },
  raw: unknown,
  config: ContactImportConfig,
) {
  const input = ImportInput.parse(raw);
  if (input.includeNameMatches && !config.allowNameDuplicates)
    throw new WorkOrderApiError(
      'Tedarikçi adı benzersiz olmalı; aynı adlı kartları kontrol edin.',
      400,
    );
  const COLUMNS = config.columns;
  let parsed: ParsedCustomerImport;
  try {
    parsed = config.parse(input.text);
  } catch (error) {
    throw new WorkOrderApiError(
      error instanceof Error ? error.message : 'Dosya okunamadı',
      400,
    );
  }

  const run = async (tx: Db) => {
    // Only cards relevant to this file cross the database boundary. No unrelated contacts,
    // financial columns or JSON attachments are fetched just to preview a short CSV.
    const keys = parsed.rows
      .filter((row) => !row.errors.length)
      .map((row) => identityKeys(row.data));
    const values = (kind: 'tax' | 'email' | 'phone' | 'name') => [
      ...new Set(
        keys
          .map((key) => key[kind])
          .filter((key): key is string => Boolean(key)),
      ),
    ];
    let matching = tx`tax_number = ANY(${tx.array(values('tax'))}::text[])
      OR lower(email) = ANY(${tx.array(values('email'))}::text[])
      OR right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10) = ANY(${tx.array(values('phone'))}::text[])`;
    for (const column of [COLUMNS.fullName, COLUMNS.companyName]) {
      if (column)
        matching = tx`${matching} OR ${foldSql(tx, tx(column))} = ANY(${tx.array(values('name'))}::text[])`;
    }
    const columns = [
      ...new Set([
        'id',
        'is_active',
        'updated_at',
        ...Object.values(COLUMNS),
        ...(config.table === 'suppliers' ? ['version'] : []),
      ]),
    ];
    const stored: Array<Record<string, any>> = await tx`
      SELECT ${tx(columns)} FROM ${tx(config.table)} WHERE tenant_id = ${actor.tenantId}
      AND (${matching}) ORDER BY id LIMIT 10001 ${input.dryRun ? tx`` : tx`FOR UPDATE`}`;
    if (stored.length > 10000)
      throw new WorkOrderApiError(
        'Bu dosya çok fazla kayıtla eşleşiyor. Listeyi küçük dosyalara bölüp yinelenen kartları kontrol edin.',
        400,
      );
    const rows = stored.map((card) => ({ id: String(card.id), raw: card }));
    const previewHash = createHash('sha256')
      .update(
        JSON.stringify({
          table: config.table,
          tenant: actor.tenantId,
          user: actor.userId,
          text: input.text,
          fillEmpty: input.fillEmpty,
          includeNameMatches: input.includeNameMatches,
          columns: COLUMNS,
          rows,
        }),
      )
      .digest('hex');
    if (!input.dryRun && input.previewHash !== previewHash) {
      throw new WorkOrderApiError(
        `${config.label} listesi, dosya veya seçenekler değişti. Önizlemeyi yenileyip tekrar onaylayın.`,
        409,
      );
    }
    const known = indexCards(rows, COLUMNS);
    const results: ImportResultRow[] = [];
    for (const row of parsed.rows) {
      const name = config.displayName(row.data);
      const result = { line: row.line, name };
      if (row.errors.length) {
        results.push({ ...result, outcome: 'error', errors: row.errors });
        continue;
      }
      const ids = identityKeys(row.data);
      const matches = new Set<Card>();
      for (const kind of ['tax', 'email', 'phone'] as const) {
        const key = ids[kind];
        if (key)
          known.indexes[kind].get(key)?.forEach((card) => matches.add(card));
      }
      if (matches.size > 1) {
        results.push({
          ...result,
          outcome: 'error',
          errors: [
            'Vergi numarası, e-posta veya telefon birden fazla karta işaret ediyor. Kartları kontrol edin.',
          ],
        });
        continue;
      }
      const match = matches.values().next().value as Card | undefined;
      if (match) {
        if (match.raw.is_active === false) {
          results.push({
            ...result,
            outcome: 'error',
            errors: [
              'Bu kart arşivli. Kartı inceleyip gerektiğinde yeniden etkinleştirin.',
            ],
          });
          continue;
        }
        const currentIds = identityKeys(fields(match, COLUMNS));
        if (
          (ids.tax && currentIds.tax && ids.tax !== currentIds.tax) ||
          (ids.email && currentIds.email && ids.email !== currentIds.email) ||
          (ids.phone && currentIds.phone && ids.phone !== currentIds.phone)
        ) {
          results.push({
            ...result,
            outcome: 'error',
            errors: [
              'Eşleşen kartın vergi numarası, e-posta veya telefonu dosyayla çelişiyor. Kartı kontrol edin.',
            ],
          });
          continue;
        }
        const filled = input.fillEmpty
          ? config.fillable.filter(
              (f) => COLUMNS[f] && row.data[f] && empty(match.raw[COLUMNS[f]!]),
            )
          : [];
        if (filled.length) {
          const updates = Object.fromEntries(
            filled.map((f) => [COLUMNS[f], row.data[f]]),
          );
          if (!input.dryRun && !match.virtual) {
            await tx`UPDATE ${tx(config.table)} SET ${tx(updates)}, updated_at = now() ${config.table === 'suppliers' ? tx`, version = version + 1` : tx``} WHERE id = ${match.id} AND tenant_id = ${actor.tenantId}`;
            await recordAudit(tx, {
              tenantId: actor.tenantId,
              actorId: actor.userId,
              entityType: config.entityType,
              entityId: match.id,
              action: 'field_updated',
              metadata: { source: 'import', fields: Object.keys(updates) },
            });
          }
          Object.assign(match.raw, updates);
          known.add(match);
        }
        results.push({
          ...result,
          outcome: filled.length ? 'fill' : 'exists',
          ...(!match.virtual ? { matchedId: String(match.id) } : {}),
          ...(filled.length ? { filled: filled.map((f) => COLUMNS[f]!) } : {}),
        });
        continue;
      }
      const named = known.indexes.name.get(ids.name);
      if (named?.size && !input.includeNameMatches) {
        const card =
          named.size === 1 ? (named.values().next().value as Card) : null;
        results.push({
          ...result,
          outcome: 'name_match',
          ...(card && !card.virtual ? { matchedId: String(card.id) } : {}),
        });
        continue;
      }
      const values = Object.fromEntries(
        Object.entries(COLUMNS).map(([f, c]) => [
          c,
          row.data[f as keyof CustomerImportFields],
        ]),
      );
      const card: Card = {
        id: `import:${row.line}`,
        raw: { ...values, is_active: true },
        virtual: input.dryRun,
      };
      if (!input.dryRun) {
        const [created] =
          await tx`INSERT INTO ${tx(config.table)} ${tx({ ...values, tenant_id: actor.tenantId })} RETURNING id`;
        card.id = String(created.id);
        await recordAudit(tx, {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          entityType: config.entityType,
          entityId: card.id,
          action: 'created',
          metadata: { source: 'import' },
        });
      }
      known.add(card);
      results.push({ ...result, outcome: 'new' });
    }
    const summary = {
      new: results.filter((r) => r.outcome === 'new').length,
      exists: results.filter((r) => r.outcome === 'exists').length,
      filled: results.filter((r) => r.outcome === 'fill').length,
      nameMatches: results.filter((r) => r.outcome === 'name_match').length,
      errors: results.filter((r) => r.outcome === 'error').length,
    };
    if (!input.dryRun)
      await recordAudit(tx, {
        tenantId: actor.tenantId,
        actorId: actor.userId,
        entityType: 'tenant',
        entityId: actor.tenantId,
        action: `${config.table}_imported`,
        metadata: summary,
      });
    return {
      dryRun: input.dryRun,
      previewHash,
      columns: parsed.columns,
      ignored: parsed.ignored,
      summary,
      rows: results,
    };
  };
  if (input.dryRun) return run(db);
  return db.begin(async (tx: Db) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${actor.tenantId + (config.table === 'customers' ? ':customer-create' : ':supplier-create')}, 0))`;
    return run(tx);
  });
}
