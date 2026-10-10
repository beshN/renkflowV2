import 'server-only';

import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { changedFields, recordAudit } from '@/lib/audit/audit-log';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { columnExists } from '@/lib/db/schema-guard';
import { compareQueue, type Priority } from '@/lib/ai/detectors/engine';
import { getAiSettings } from '@/lib/ai/gate.server';
import { resolveMemberAccess } from '@/lib/security/member-access.server';
import { can } from '@/lib/security/access-matrix';
import type { SuggestionKind } from './kinds';

/**
 * Kinds this member may see: base role, their own module cell (a custom role narrows the base
 * role), and none whose card carries a field group they hide. `need` = 'approve' also needs the
 * kind's action.
 */
async function visibleKinds(actor: SuggestionActor, kinds: SuggestionKind<any>[], need: 'view' | 'approve' = 'view') {
  const byRole = kinds.filter((k) => k.roles.includes(actor.role));
  if (!byRole.some((k) => k.access || k.sensitive?.length)) return byRole;
  const access = await resolveMemberAccess(actor.userId, actor.tenantId).catch(() => null);
  if (!access) return byRole.filter((k) => !k.access && !k.sensitive?.length);
  return byRole.filter((k) =>
    (!k.access || (can(access, k.access.module, 'view') && (need === 'view' || can(access, k.access.module, k.access.action))))
    && !(k.sensitive ?? []).some((g) => access.hidden.includes(g)));
}
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
  // Proactive detectors (048): which detector, how urgent, the evidence pack and the rule in words.
  detector: z.string().max(60).nullish(),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  evidence: z.object({
    badges: z.array(z.object({ label: z.string().max(60), tone: z.string().max(20).optional(), kind: z.string().max(20).optional() })).max(6),
    records: z.array(z.object({ entityType: z.string().max(60), entityId: z.string().max(80), label: z.string().max(200), href: z.string().max(300).optional() })).max(30),
    numbers: z.record(z.string().max(60), z.union([z.number(), z.string().max(200), z.null()])),
  }).nullish(),
  confidence: z.enum(['high', 'medium', 'low']).nullish(),
  rule: z.string().max(500).nullish(),
});

let detectorColumns: boolean | null = null;
/** The detector columns exist only after migration 048; until then suggestions are filed as before. */
async function hasDetectorColumns() {
  if (detectorColumns === null) detectorColumns = await columnExists('ai_suggestions', 'evidence');
  return detectorColumns;
}

let ready: boolean | null = null;

/** The queue exists only after migration 029; until then every screen that uses it stays hidden. */
export async function suggestionsAvailable(): Promise<boolean> {
  if (ready) return true;
  const [row] = await sql`SELECT to_regclass('public.ai_suggestions') IS NOT NULL AS ok`;
  ready = Boolean(row?.ok);
  return ready;
}

/** Files a suggestion for people to decide. The same open situation (dedupe key) is filed once. */
export async function fileSuggestion(
  db: any,
  tenantId: string,
  actorId: string | null,
  raw: z.input<typeof FileSuggestionSchema>,
  options: { notAgainAfterRejection?: boolean } = {},
) {
  const input = FileSuggestionSchema.parse(raw);
  const definition = suggestionKind(input.kind);
  if (!definition) throw new Error(`Bilinmeyen öneri türü: ${input.kind}`);
  const payload = definition.payloadSchema.parse(input.payload);
  if (input.uncertain && !input.uncertaintyNote) throw new Error('Emin olunmayan öneri, neden emin olunmadığını yazmalı.');
  // Opt-in per kind: a situation someone rejected is not filed again until it changes (new key).
  if (options.notAgainAfterRejection && input.dedupeKey) {
    const [rejected] = await db`SELECT * FROM ai_suggestions WHERE tenant_id = ${tenantId} AND kind = ${input.kind} AND dedupe_key = ${input.dedupeKey} AND status = 'rejected' ORDER BY decided_at DESC NULLS LAST LIMIT 1`;
    if (rejected) return { suggestion: rejected, created: false };
  }
  const [row] = await db`
    INSERT INTO ai_suggestions (tenant_id, kind, title, rationale, payload, affected, uncertain, uncertainty_note, source, model, dedupe_key, created_by)
    VALUES (${tenantId}, ${input.kind}, ${input.title}, ${input.rationale}, ${JSON.stringify(payload)}::text::jsonb, ${JSON.stringify(input.affected)}::text::jsonb,
      ${input.uncertain}, ${input.uncertaintyNote ?? null}, ${input.source}, ${input.model ?? null}, ${input.dedupeKey ?? null}, ${actorId})
    ON CONFLICT (tenant_id, kind, dedupe_key) WHERE dedupe_key IS NOT NULL AND status = 'pending' DO NOTHING
    RETURNING *
  `;
  if (row && input.detector && (await hasDetectorColumns()))
    await db`UPDATE ai_suggestions SET detector = ${input.detector}, priority = ${input.priority}, evidence = ${JSON.stringify(input.evidence ?? {})}::text::jsonb,
      confidence = ${input.confidence ?? null}, rule = ${input.rule ?? null} WHERE id = ${row.id}`;
  if (!row) {
    const [existing] = await db`SELECT * FROM ai_suggestions WHERE tenant_id = ${tenantId} AND kind = ${input.kind} AND dedupe_key = ${input.dedupeKey} AND status = 'pending'`;
    return { suggestion: existing, created: false };
  }
  await recordAudit(db, { tenantId, actorId, entityType: 'ai_suggestion', entityId: row.id, action: 'created', metadata: { kind: input.kind, source: input.source, model: input.model ?? null, uncertain: input.uncertain } });
  return { suggestion: row, created: true };
}

/**
 * Pending suggestions of another situation of the same kind are out of date once the situation
 * changed (e.g. a new job joined the cutting pool): they are expired, not left to be approved.
 */
/** Pending suggestions of a kind whose situation is gone (the detector no longer finds it) are expired. */
export async function expireResolved(db: any, tenantId: string, kind: string, keys: string[]) {
  if (!keys.length) return 0;
  const expired = await db`UPDATE ai_suggestions SET status = 'expired', decided_at = now(), version = version + 1
    WHERE tenant_id = ${tenantId} AND kind = ${kind} AND status = 'pending' AND dedupe_key = ANY(${keys}) RETURNING id`;
  for (const row of expired)
    await recordAudit(db, { tenantId, actorId: null, entityType: 'ai_suggestion', entityId: row.id, action: 'expired', metadata: { kind, reason: 'resolved' } });
  return expired.length;
}

export async function expireOtherPending(db: any, tenantId: string, kind: string, keepDedupeKey: string | null) {
  const expired = await db`
    UPDATE ai_suggestions SET status = 'expired', decided_at = now(), version = version + 1
    WHERE tenant_id = ${tenantId} AND kind = ${kind} AND status = 'pending'
      AND (${keepDedupeKey}::text IS NULL OR dedupe_key IS DISTINCT FROM ${keepDedupeKey})
    RETURNING id
  `;
  for (const row of expired)
    await recordAudit(db, { tenantId, actorId: null, entityType: 'ai_suggestion', entityId: row.id, action: 'expired', metadata: { kind, reason: 'situation_changed' } });
  return expired.length;
}

const lastRefresh = new Map<string, number>();
/** Something changed (an order moved, a payment came in): the next listing looks again at once. */
export function triggerRefresh(tenantId: string, kinds?: string[]) {
  for (const key of lastRefresh.keys()) if (key.startsWith(tenantId + ':') && (!kinds || kinds.includes(key.slice(tenantId.length + 1)))) lastRefresh.delete(key);
}
/** Lets each kind look at the firm's records; one failing kind never hides the others. */
async function refreshSuggestions(actor: SuggestionActor, kinds: ReturnType<typeof suggestionKinds>) {
  for (const kind of kinds) {
    if (!kind.refresh) continue;
    const key = actor.tenantId + ':' + kind.kind;
    if (Date.now() - (lastRefresh.get(key) ?? 0) < 60_000) continue;
    lastRefresh.set(key, Date.now());
    try {
      await kind.refresh(actor);
    } catch (error) {
      console.error('[AI suggestions] refresh failed', kind.kind, error instanceof Error ? error.message : error);
    }
  }
}

/** Pending suggestions of the kinds this role may decide, newest first. */
export async function listPendingSuggestions(actor: SuggestionActor, options: { refresh?: boolean } = {}) {
  const kinds = await visibleKinds(actor, suggestionKinds());
  if (!kinds.length) return [];
  // Assistant off: nothing looks at the records on its own; only suggestions a person asked for
  // (e.g. a count list they uploaded) stay in the queue.
  const off = (await getAiSettings(actor.tenantId)).mode === 'off';
  if (options.refresh !== false && !off) await refreshSuggestions(actor, kinds);
  const detector = await hasDetectorColumns();
  // A snoozed suggestion stays open but out of sight until its day.
  const rows = detector
    ? await sql`
      SELECT id, kind, title, rationale, payload, affected, uncertain, uncertainty_note, source, model, edited, version, created_at, detector, priority, evidence, confidence, rule
      FROM ai_suggestions
      WHERE tenant_id = ${actor.tenantId} AND status = 'pending' AND kind IN ${sql(kinds.map((k) => k.kind))} AND (snoozed_until IS NULL OR snoozed_until <= now())
      ORDER BY created_at DESC LIMIT 100`
    : await sql`
      SELECT id, kind, title, rationale, payload, affected, uncertain, uncertainty_note, source, model, edited, version, created_at
      FROM ai_suggestions
      WHERE tenant_id = ${actor.tenantId} AND status = 'pending' AND kind IN ${sql(kinds.map((k) => k.kind))}
      ORDER BY created_at DESC LIMIT 50`;
  return rows.map((row: any) => {
    const kind = suggestionKind(row.kind)!;
    return {
      id: row.id, kind: row.kind, kindLabel: kind.label, title: row.title, rationale: row.rationale, payload: row.payload,
      affected: row.affected, uncertain: row.uncertain, uncertaintyNote: row.uncertainty_note, source: row.source,
      model: row.model, edited: row.edited, version: row.version, createdAt: new Date(row.created_at).toISOString(), editableFields: kind.editableFields ?? [],
      detector: row.detector ?? null, priority: (row.priority ?? 'medium') as Priority, evidence: row.evidence && Object.keys(row.evidence).length ? row.evidence : null,
      confidence: row.confidence ?? null, rule: row.rule ?? null, icon: kind.icon ?? null,
    };
  }).filter((row: { detector: string | null }) => !off || !row.detector).sort(compareQueue).slice(0, 50);
}

export const DecisionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), expectedVersion: z.number().int().positive() }),
  z.object({
    action: z.literal('reject'), expectedVersion: z.number().int().positive(), note: z.string().trim().max(500).optional(),
    // 'never' = "bunu bir daha önerme" for this very situation.
    reason: z.enum(['not_relevant', 'wrong', 'already_done', 'never', 'other']).optional(),
  }),
  z.object({ action: z.literal('snooze'), expectedVersion: z.number().int().positive(), days: z.number().int().min(1).max(30) }),
  z.object({ action: z.literal('edit'), expectedVersion: z.number().int().positive(), payload: z.record(z.string(), z.unknown()), note: z.string().trim().max(500).optional() }),
]);

/**
 * Approve (runs the kind's command), reject, or edit (keeps the correction as an eval example).
 * A refused approval rolls back and leaves the suggestion pending with the reason returned.
 */
export async function decideSuggestion(actor: SuggestionActor, id: string, raw: unknown) {
  const decision = DecisionSchema.parse(raw);
  try {
    return await decide(actor, id, decision);
  } catch (error) {
    // Refused because the situation changed: the next listing looks at the records again at once.
    if (error instanceof WorkOrderApiError && error.status === 409)
      for (const key of lastRefresh.keys()) if (key.startsWith(actor.tenantId + ':')) lastRefresh.delete(key);
    throw error;
  }
}

async function decide(actor: SuggestionActor, id: string, decision: z.infer<typeof DecisionSchema>) {
  return withTransaction(async (tx: any) => {
    const [row] = await tx`SELECT * FROM ai_suggestions WHERE tenant_id = ${actor.tenantId} AND id = ${id} FOR UPDATE`;
    if (!row) throw new WorkOrderApiError('Öneri bulunamadı', 404);
    const kind = suggestionKind(row.kind);
    if (!kind || !(await visibleKinds(actor, [kind], 'approve')).length) throw new WorkOrderApiError('Bu öneriyi karara bağlama yetkiniz yok.', 403);
    if (row.status !== 'pending') throw new WorkOrderApiError('Bu öneri zaten karara bağlandı.', 409);
    if (row.version !== decision.expectedVersion) throw new WorkOrderApiError('Öneri başka bir yerde değişti. Listeyi yenileyin.', 409);

    if (decision.action === 'reject') {
      await tx`UPDATE ai_suggestions SET status = 'rejected', decided_by = ${actor.userId}, decided_at = now(), decision_note = ${decision.note || null}, version = version + 1 WHERE id = ${id}`;
      if (decision.reason && (await hasDetectorColumns())) await tx`UPDATE ai_suggestions SET reject_reason = ${decision.reason} WHERE id = ${id}`;
      await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'ai_suggestion', entityId: id, action: 'rejected', note: decision.note || null, metadata: { kind: row.kind, reason: decision.reason ?? null } });
      return { status: 'rejected' as const };
    }

    if (decision.action === 'snooze') {
      if (!(await hasDetectorColumns())) throw new WorkOrderApiError('Erteleme için veritabanı güncellemesi (048) bekleniyor', 409);
      const [updated] = await tx`UPDATE ai_suggestions SET snoozed_until = now() + make_interval(days => ${decision.days}), version = version + 1 WHERE id = ${id} RETURNING version, snoozed_until`;
      await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'ai_suggestion', entityId: id, action: 'snoozed', metadata: { kind: row.kind, days: decision.days } });
      return { status: 'pending' as const, version: updated.version as number, snoozedUntil: new Date(updated.snoozed_until).toISOString() };
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
