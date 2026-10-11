import 'server-only';

import { sql } from '@/lib/db';
import { tableExists } from '@/lib/db/schema-guard';

/**
 * Scheduled run: a few firms per tick whose detectors have not run for 6 hours (oldest first).
 * The firm is claimed before the run, so two ticks never run the same firm. Errors are reported,
 * never thrown: the other clean-up work of the tick goes on.
 */
export async function runDetectorsDue(limit = 2) {
  try {
    if (!(await tableExists('ai_settings')) || !(await tableExists('ai_suggestions'))) return { ran: 0 };
    const due = await sql`SELECT t.id FROM tenants t LEFT JOIN ai_settings s ON s.tenant_id = t.id
      WHERE coalesce(s.mode, 'assist') <> 'off' AND (s.detectors_ran_at IS NULL OR s.detectors_ran_at < now() - interval '6 hours')
      ORDER BY s.detectors_ran_at NULLS FIRST LIMIT ${limit}`;
    const { runAllDetectors } = await import('./registry.server');
    let ran = 0;
    for (const t of due) {
      const [claimed] = await sql`INSERT INTO ai_settings (tenant_id, detectors_ran_at) VALUES (${t.id}, now())
        ON CONFLICT (tenant_id) DO UPDATE SET detectors_ran_at = now()
          WHERE ai_settings.detectors_ran_at IS NULL OR ai_settings.detectors_ran_at < now() - interval '6 hours'
        RETURNING tenant_id`;
      if (!claimed) continue;
      await runAllDetectors(String(t.id));
      ran++;
    }
    return { ran };
  } catch (error) {
    console.error('[ai] scheduled detectors failed', error instanceof Error ? error.message : error);
    return { ran: 0, error: true };
  }
}
