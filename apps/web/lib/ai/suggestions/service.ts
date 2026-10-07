import 'server-only';

import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { changedFields, recordAudit } from '@/lib/audit/audit-log';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { suggestionKind, suggestionKinds, type SuggestionActor } from './kinds';
import './registry';

export type AffectedRecord = { entityType: string; entityId: string; label: string; href?: string };

export const FileSuggestionSchema = z.object({
  kind: z.string().min(1).max(60),
  title: z.string().trim().min(3).max(200),
  rationale: z.string().trim().min(3).max(4000),
  payload: z.record(z.string(), z.unknown()),
  affected: z.array(z.object({ entityType: z.string().max(60), entityId: z.string().max(80), label: z.string().max(200), href: z.string().max(300).optional() })).max(50).default([]),
  /** The suggestion must say when it is not sure, instead of presenting a guess as fact. */
  uncertain: z.boolean().default(false),
  uncertaintyNote: z.string().trim().max(1000).nullish(),
  source: z.enum(['system', 'model']).default('system'),
  model: z.string().max(80).nullish(),
  dedupeKey: z.string().max(200).nullish(),
});

let ready: boolean | null = null;

/** The queue exists only after migration 029; until then every screen that uses it stays hidden. */
export async function suggestionsAvailable(): Promise<boolean> {
  if (ready) return true;
  const [row] = await sql`SELECT to_regclass('public.ai_suggestions') IS NOT NULL AS ok`;
  ready = Boolean(row?.ok);
  return ready;
}

/** Files a suggestion for people to decide. The same open situation (dedupe key) is filed once. */
export async function fileSuggestion(db: any, tenantId: string, actorId: string | null, raw: z.input<typeof FileSuggestionSchema>) {
  const input = FileSuggestionSchema.parse(raw);
  const definition = suggestionKind(input.kind);
  if (!definition) throw new Error(`Bilinmeyen öneri türü: ${input.kind}`);
  const payload = definition.payloadSchema.parse(input.payload);
  if (input.uncertain && !input.uncertaintyNote) throw new Error('Emin olunmayan öneri, neden emin olunmadığını yazmalı.');
  const [row] = await db`
    INSERT INTO ai_suggestions (tenant_id, kind, title, rationale, payload, affected, uncertain, uncertainty_note, source, model, dedupe_key, created_by)
    VALUES (${tenantId}, ${input.kind}, ${input.title}, ${input.rationale}, ${JSON.stringify(payload)}::text::jsonb, ${JSON.stringify(input.affected)}::text::jsonb,
      ${input.uncertain}, ${input.uncertaintyNote ?? null}, ${input.source}, ${input.model ?? null}, ${input.dedupeKey ?? null}, ${actorId})
    ON CONFLICT (tenant_id, kind, dedupe_key) WHERE dedupe_key IS NOT NULL AND status = 'pending' DO NOTHING
    RETURNING *
  `;
  if (!row) {
    const [existing] = await db`SELECT * FROM ai_suggestions WHERE tenant_id = ${tenantId} AND kind = ${input.kind} AND dedupe_key = ${input.dedupeKey} AND status = 'pending'`;
    return { suggestion: existing, created: false };
  }
  await recordAudit(db, { tenantId, actorId, entityType: 'ai_suggestion', entityId: row.id, action: 'created', metadata: { kind: input.kind, source: input.source, model: input.model ?? null, uncertain: input.uncertain } });
  return { suggestion: row, created: true };
}

/** Pending suggestions of the kinds this role may decide, newest first. */
export async function listPendingSuggestions(actor: SuggestionActor) {
  const kinds = suggestionKinds().filter((kind) => kind.roles.includes(actor.role));
  if (!kinds.length) return [];
  const rows = await sql`
    SELECT id, kind, title, rationale, payload, affected, uncertain, uncertainty_note, source, model, edited, version, created_at
    FROM ai_suggestions
    WHERE tenant_id = ${actor.tenantId} AND status = 'pending' AND kind IN ${sql(kinds.map((k) => k.kind))}
    ORDER BY created_at DESC
    LIMIT 50
  `;
  return rows.map((row: any) => {
    const kind = suggestionKind(row.kind)!;
    return {
      id: row.id, kind: row.kind, kindLabel: kind.label, title: row.title, rationale: row.rationale, payload: row.payload,
      affected: row.affected, uncertain: row.uncertain, uncertaintyNote: row.uncertainty_note, source: row.source,
      model: row.model, edited: row.edited, version: row.version, createdAt: row.created_at, editableFields: kind.editableFields ?? [],
    };
  });
}

export const DecisionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), expectedVersion: z.number().int().positive() }),
  z.object({ action: z.literal('reject'), expectedVersion: z.number().int().positive(), note: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal('edit'), expectedVersion: z.number().int().positive(), payload: z.record(z.string(), z.unknown()), note: z.string().trim().max(500).optional() }),
]);

/**
 * Approve (runs the kind's command), reject, or edit (keeps the correction as an eval example).
 * A refused approval rolls back and leaves the suggestion pending with the reason returned.
 */
export async function decideSuggestion(actor: SuggestionActor, id: string, raw: unknown) {
  const decision = DecisionSchema.parse(raw);
  return withTransaction(async (tx: any) => {
    const [row] = await tx`SELECT * FROM ai_suggestions WHERE tenant_id = ${actor.tenantId} AND id = ${id} FOR UPDATE`;
    if (!row) throw new WorkOrderApiError('Öneri bulunamadı', 404);
    const kind = suggestionKind(row.kind);
    if (!kind || !kind.roles.includes(actor.role)) throw new WorkOrderApiError('Bu öneriyi karara bağlama yetkiniz yok.', 403);
    if (row.status !== 'pending') throw new WorkOrderApiError('Bu öneri zaten karara bağlandı.', 409);
    if (row.version !== decision.expectedVersion) throw new WorkOrderApiError('Öneri başka bir yerde değişti. Listeyi yenileyin.', 409);

    if (decision.action === 'reject') {
      await tx`UPDATE ai_suggestions SET status = 'rejected', decided_by = ${actor.userId}, decided_at = now(), decision_note = ${decision.note || null}, version = version + 1 WHERE id = ${id}`;
      await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'ai_suggestion', entityId: id, action: 'rejected', note: decision.note || null, metadata: { kind: row.kind } });
      return { status: 'rejected' as const };
    }

    if (decision.action === 'edit') {
      const editable = new Set((kind.editableFields ?? []).map((field) => field.key));
      if (!editable.size) throw new WorkOrderApiError('Bu öneri türü düzenlenemez.', 400);
      const changes = Object.fromEntries(Object.entries(decision.payload).filter(([key]) => editable.has(key)));
      const corrected = kind.payloadSchema.parse({ ...row.payload, ...changes });
      // Compare what will be stored, after the schema's own coercion, not the raw input.
      const diff = changedFields(row.payload, corrected);
      if (!Object.keys(diff).length) throw new WorkOrderApiError('Değişiklik yok.', 400);
      await tx`
        INSERT INTO ai_feedback_examples (tenant_id, suggestion_id, kind, original_payload, corrected_payload, note, created_by)
        VALUES (${actor.tenantId}, ${id}, ${row.kind}, ${JSON.stringify(row.payload)}::text::jsonb, ${JSON.stringify(corrected)}::text::jsonb, ${decision.note || null}, ${actor.userId})
      `;
      const [updated] = await tx`UPDATE ai_suggestions SET payload = ${JSON.stringify(corrected)}::text::jsonb, edited = true, version = version + 1 WHERE id = ${id} RETURNING version`;
      await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'ai_suggestion', entityId: id, action: 'edited', changes: diff, note: decision.note || null, metadata: { kind: row.kind } });
      return { status: 'pending' as const, version: updated.version as number, payload: corrected };
    }

    const payload = kind.payloadSchema.parse(row.payload);
    const result = await kind.apply(tx, actor, payload, { id: row.id, title: row.title });
    await tx`UPDATE ai_suggestions SET status = 'approved', decided_by = ${actor.userId}, decided_at = now(), result = ${JSON.stringify(result)}::text::jsonb, version = version + 1 WHERE id = ${id}`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'ai_suggestion', entityId: id, action: 'approved', metadata: { kind: row.kind, result, edited: row.edited } });
    return { status: 'approved' as const, result };
  });
}
