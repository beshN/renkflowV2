import 'server-only';

import { sql } from '@/lib/db';
import { anySignal, buildChecklist, type OnboardingChecklist, type OnboardingSignals } from './checklist';

type Row = Record<string, unknown>;

/** One small read; a missing table or column gives "unknown" instead of failing the checklist. */
async function flag(query: PromiseLike<unknown>): Promise<boolean | null> {
  try {
    const rows = (await query) as Row[];
    const value = rows?.[0]?.done;
    return typeof value === 'boolean' ? value : value == null ? null : Boolean(value);
  } catch {
    return null;
  }
}

/** Reads each step from the firm's records. Every query is tenant-scoped and read-only. */
export async function readOnboardingSignals(tenantId: string): Promise<{ signals: OnboardingSignals; recorded: string[] }> {
  const [profile, centers, orders, members, invitations, assigned, recorded] = await Promise.all([
    flag(sql`
      SELECT COALESCE(
        NULLIF(btrim(to_jsonb(t)->>'legal_name'), ''),
        NULLIF(btrim(to_jsonb(t)->>'tax_number'), ''),
        NULLIF(btrim(to_jsonb(t)->>'phone'), ''),
        NULLIF(btrim(to_jsonb(t)->>'logo_url'), '')
      ) IS NOT NULL AS done
      FROM tenants t
      WHERE t.id = ${tenantId}
    `),
    flag(sql`SELECT EXISTS(SELECT 1 FROM work_centers WHERE tenant_id = ${tenantId} AND active) AS done`),
    flag(sql`
      SELECT EXISTS(
        SELECT 1 FROM orders o
        WHERE o.tenant_id = ${tenantId} AND COALESCE((to_jsonb(o)->>'provisional')::boolean, false) = false
      ) AS done
    `),
    flag(sql`SELECT (SELECT COUNT(*) FROM tenant_members WHERE tenant_id = ${tenantId}) > 1 AS done`),
    flag(sql`SELECT EXISTS(SELECT 1 FROM invitations WHERE tenant_id = ${tenantId}) AS done`),
    flag(sql`SELECT EXISTS(SELECT 1 FROM work_orders WHERE tenant_id = ${tenantId} AND assigned_to IS NOT NULL) AS done`),
    (async () => {
      try {
        const rows = (await sql`
          SELECT step_key FROM onboarding_steps WHERE tenant_id = ${tenantId} AND completed = true
        `) as Row[];
        return rows.map((row) => String(row.step_key));
      } catch {
        return [] as string[];
      }
    })(),
  ]);

  return {
    signals: {
      tenant_profile: profile,
      workstation_setup: centers,
      first_order_created: orders,
      first_operator_invited: anySignal(members, invitations),
      first_work_order_assigned: assigned,
    },
    recorded,
  };
}

export async function getOnboardingChecklist(tenantId: string): Promise<OnboardingChecklist | null> {
  const { signals, recorded } = await readOnboardingSignals(tenantId);
  return buildChecklist(signals, recorded);
}
