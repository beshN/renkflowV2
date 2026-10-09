import 'server-only';

import type { z } from 'zod';
import { sql } from '@/lib/db';
import { columnExists } from '@/lib/db/schema-guard';
import type { UserRole } from '@/lib/features/auth/permissions';
import { registerSuggestionKind, type EditableField, type SuggestionActor } from '@/lib/ai/suggestions/kinds';
import { getAiSettings } from '@/lib/ai/gate.server';
import { detectorSettings, resolvedKeys, suppression, type DetectorHistory, type DetectorSettings, type Finding } from './engine';

/**
 * A proactive detector: looks at the firm's records (SQL + pure rules, no model), returns findings
 * with their evidence; approval runs `apply` through the domain's own command. Registered as a
 * suggestion kind "detector.<key>", so the queue, roles, approval and audit are the existing ones.
 */
export type DetectorDef<P extends Record<string, unknown>> = {
  key: string;
  label: string;
  /** lucide icon name for the card. */
  icon: string;
  roles: readonly UserRole[];
  defaults: DetectorSettings;
  /** What "eşik" means for this detector, shown in settings. */
  thresholdLabel?: string;
  payloadSchema: z.ZodType<P>;
  editableFields?: readonly EditableField[];
  detect: (actor: SuggestionActor, settings: DetectorSettings) => Promise<Finding<P>[]>;
  apply: (tx: any, actor: SuggestionActor, payload: P, suggestion: { id: string; title: string }) => Promise<Record<string, unknown>>;
};

const DETECTORS = new Map<string, DetectorDef<any>>();
export const detectorKind = (key: string) => `detector.${key}`;
export const listDetectors = () => [...DETECTORS.values()];

/** The suppression history of one detector for one firm, from the suggestions it filed. */
export async function detectorHistory(tenantId: string, kind: string): Promise<DetectorHistory> {
  const reasons = await columnExists('ai_suggestions', 'reject_reason');
  const rows = await sql`SELECT dedupe_key, status, decided_at, ${reasons ? sql`reject_reason` : sql`NULL::text AS reject_reason`}
    FROM ai_suggestions WHERE tenant_id = ${tenantId} AND kind = ${kind} AND (status = 'pending' OR decided_at > now() - interval '400 days')`;
  return {
    pending: new Set(rows.filter((r: any) => r.status === 'pending' && r.dedupe_key).map((r: any) => String(r.dedupe_key))),
    rejected: rows.filter((r: any) => r.status === 'rejected').map((r: any) => ({ dedupeKey: r.dedupe_key, decidedAt: new Date(r.decided_at).toISOString(), reason: r.reject_reason ?? null })),
    approved: rows.filter((r: any) => r.status === 'approved').length,
    decided: rows.filter((r: any) => r.status === 'approved' || r.status === 'rejected').length,
  };
}

/** One run of a detector for a firm: find, suppress, file, and close what is resolved. */
export async function runDetector(def: DetectorDef<any>, actor: SuggestionActor) {
  const ai = await getAiSettings(actor.tenantId);
  if (ai.mode === 'off') return { filed: 0, skipped: 0, expired: 0 };
  const settings = detectorSettings(def.defaults, ai.detectors[def.key]);
  const kind = detectorKind(def.key);
  const { fileSuggestion, expireResolved } = await import('@/lib/ai/suggestions/service');
  const history = await detectorHistory(actor.tenantId, kind);
  // A detector switched off closes what it had open and files nothing.
  if (!settings.enabled) return { filed: 0, skipped: 0, expired: await expireResolved(sql, actor.tenantId, kind, [...history.pending]) };
  const findings = await def.detect(actor, settings);
  const now = Date.now();
  let filed = 0;
  let skipped = 0;
  for (const f of findings) {
    const s = suppression(f, history, settings, now);
    if (!s.file) { skipped++; continue; }
    const r = await fileSuggestion(sql, actor.tenantId, null, {
      kind, title: f.title, rationale: f.rationale, payload: f.draft ? { ...f.payload, message: f.draft.text } : f.payload,
      affected: f.evidence.records.slice(0, 50), dedupeKey: f.dedupeKey, source: 'system',
      uncertain: f.confidence === 'low', uncertaintyNote: f.confidence === 'low' ? 'Kanıt sınırlı; kararı kayıtlara bakarak verin.' : null,
      detector: def.key, priority: f.priority, evidence: f.evidence, confidence: f.confidence, rule: f.rule,
    });
    if (r.created) filed++;
  }
  const expired = await expireResolved(sql, actor.tenantId, kind, resolvedKeys(history.pending, findings));
  return { filed, skipped, expired };
}

export function registerDetector<P extends Record<string, unknown>>(def: DetectorDef<P>) {
  DETECTORS.set(def.key, def);
  registerSuggestionKind<P>({
    kind: detectorKind(def.key), label: def.label, icon: def.icon, roles: def.roles, payloadSchema: def.payloadSchema,
    editableFields: def.editableFields, apply: def.apply,
    refresh: async (actor) => { await runDetector(def, actor); },
  });
}

/** Every detector for one firm (the daily run, and the cron), as a system actor. */
export async function runAllDetectors(tenantId: string) {
  const out: Record<string, { filed: number; skipped: number; expired: number } | { error: string }> = {};
  for (const def of listDetectors()) {
    try {
      out[def.key] = await runDetector(def, { tenantId, userId: '00000000-0000-0000-0000-000000000000', role: 'owner' });
    } catch (e) {
      out[def.key] = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return out;
}
