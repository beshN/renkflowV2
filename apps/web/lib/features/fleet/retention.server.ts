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
    // The vehicle list (small) drives the clean-up, never a scan of the position history; each
    // delete walks the (tenant, vehicle, recorded_at) index.
    const vehicles = await sql`SELECT v.tenant_id, v.id, coalesce(s.position_retention_days, CASE WHEN s.tenant_id IS NULL THEN 365 END) AS days
      FROM vehicles v LEFT JOIN fleet_settings s ON s.tenant_id = v.tenant_id`;
    let removed = 0;
    for (const v of vehicles) {
      const cutoff = retentionCutoff(v.days === null ? null : Number(v.days), Date.now());
      if (!cutoff) continue;
      const rows = await sql`DELETE FROM vehicle_positions WHERE id IN (SELECT id FROM vehicle_positions
        WHERE tenant_id = ${v.tenant_id} AND vehicle_id = ${v.id} AND recorded_at < ${cutoff} ORDER BY recorded_at LIMIT ${batch}) RETURNING id`;
      removed += rows.length;
    }
    return removed;
  } catch (error) {
    console.error('[fleet] position clean-up failed', error instanceof Error ? error.message : error);
    return 0;
  }
}
