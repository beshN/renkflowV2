import 'server-only';
import { sql, withTransaction } from '@/lib/db';
import { AuthorizationError, type ServerUserContext } from '@/lib/auth/serverAuth';
import { recordAudit } from '@/lib/audit/audit-log';

// Context comes exclusively from requireTenantContext in the route, never request JSON.
export async function readFunFeatures(context: Pick<ServerUserContext, 'tenantId' | 'userId'>) {
  const [row] = await sql`
    SELECT COALESCE((to_jsonb(t)->>'fun_features_enabled')::boolean, true) AS enabled, m.role
    FROM tenants t JOIN tenant_members m ON m.tenant_id = t.id
    WHERE t.id = ${context.tenantId} AND m.user_id = ${context.userId}
      AND (to_jsonb(m)->>'deactivated_at') IS NULL
  `;
  if (!row) throw new AuthorizationError();
  return { enabled: row.enabled === true, canEdit: ['owner', 'admin'].includes(row.role) };
}

export async function saveFunFeatures(context: Pick<ServerUserContext, 'tenantId' | 'userId'>, enabled: boolean) {
  return withTransaction(async tx => {
    // Re-read and lock the live membership: stale sessions and concurrent demotion cannot grant a write.
    const [member] = await tx`
      SELECT role FROM tenant_members WHERE tenant_id = ${context.tenantId} AND user_id = ${context.userId}
        AND (to_jsonb(tenant_members)->>'deactivated_at') IS NULL FOR UPDATE
    `;
    if (!member || !['owner', 'admin'].includes(member.role)) throw new AuthorizationError();
    const [before] = await tx`SELECT fun_features_enabled FROM tenants WHERE id = ${context.tenantId} FOR UPDATE`;
    if (!before) throw new AuthorizationError();
    await tx`UPDATE tenants SET fun_features_enabled = ${enabled}, updated_at = now() WHERE id = ${context.tenantId}`;
    if (before.fun_features_enabled !== enabled) await recordAudit(tx, {
      tenantId: context.tenantId, actorId: context.userId, entityType: 'tenant', entityId: context.tenantId,
      action: 'settings_updated', changes: { fun_features_enabled: { from: before.fun_features_enabled, to: enabled } },
    });
    return { enabled, canEdit: true };
  });
}
