import 'server-only';

import { sql } from '@/lib/db';
import { tableExists } from '@/lib/db/schema-guard';
import { retentionCutoff } from './engine';

/**
 * Scheduled clean-up: positions older than each firm's retention are deleted (in batches).
 * Kept apart from the fleet service so the cron does not load the session code. A failure is
 * logged and reported as 0, never fails the other clean-up work.
 */
export async function pruneVehiclePositions(batch = 5000) {
  try {
    if (!(await tableExists('vehicle_positions'))) return 0;
    const firms = await sql`SELECT DISTINCT p.tenant_id, coalesce(s.position_retention_days, CASE WHEN s.tenant_id IS NULL THEN 365 END) AS days
      FROM vehicle_positions p LEFT JOIN fleet_settings s ON s.tenant_id = p.tenant_id`;
    let removed = 0;
    for (const f of firms) {
      const cutoff = retentionCutoff(f.days === null ? null : Number(f.days), Date.now());
      if (!cutoff) continue;
      const rows = await sql`DELETE FROM vehicle_positions WHERE id IN (SELECT id FROM vehicle_positions WHERE tenant_id = ${f.tenant_id} AND recorded_at < ${cutoff} LIMIT ${batch}) RETURNING id`;
      removed += rows.length;
    }
    return removed;
  } catch (error) {
    console.error('[fleet] position clean-up failed', error instanceof Error ? error.message : error);
    return 0;
  }
}
