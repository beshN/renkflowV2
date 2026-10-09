import 'server-only';
import { sql } from '@/lib/db';
import { colorInfo } from '@/lib/features/colors/color-spec';
import { type FieldActor } from '@/lib/features/field/service';

export async function mobileReferences(actor: FieldActor) {
  const colors = await sql`SELECT id, name FROM firm_colors WHERE tenant_id=${actor.tenantId} ORDER BY position, name LIMIT 500`;
  const stages = await sql`SELECT code, name FROM work_centers WHERE tenant_id=${actor.tenantId} AND active=true ORDER BY code LIMIT 100`;
  const [available] = await sql`SELECT to_regclass('public.production_reason_codes') IS NOT NULL AS reasons, to_regclass('public.installations') IS NOT NULL AS installations`;
  const reasons = available?.reasons ? await sql`SELECT kind, code, label FROM production_reason_codes WHERE tenant_id=${actor.tenantId} AND active=true ORDER BY kind, position, label LIMIT 500` : [];
  return {
    colors: colors.map((row: Record<string, unknown>) => {
      const color = colorInfo(String(row.name));
      return { id: String(row.id), label: String(row.name), code: color?.code || String(row.name), hex: color?.hex || null, finish: color?.finish || null };
    }),
    stages: stages.map((row: Record<string, unknown>) => ({ code: String(row.code), name: String(row.name) })),
    reasons: reasons.map((row: Record<string, unknown>) => ({ kind: String(row.kind), code: String(row.code), label: String(row.label) })),
    capabilities: { reasonCodes: Boolean(available?.reasons), installations: Boolean(available?.installations && actor.mobileAccess?.installations.view), remotePush: false, crashReporting: false },
  };
}
