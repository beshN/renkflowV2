import 'server-only';
import { sql } from '@/lib/db';
import { requirePermission, type ServerUserContext } from '@/lib/features/auth/serverAuth';
import { deadlineCounts, historyRange, lossByUnit, medianActiveSeconds } from './production-history';

type History = {
  centers: { code: string; name: string; completed: number; active: { n: number; median: number | null } }[];
  deadlines: ReturnType<typeof deadlineCounts>; completedJobs: number;
  calculatedLosses: ReturnType<typeof lossByUnit>; measuredLossSamples: number;
};
export async function productionHistory(context: ServerUserContext, start: string, end: string): Promise<History> {
  requirePermission(context, 'reports.view');
  const range = historyRange(start, end), t = context.tenantId;
  return sql.begin(async (tx: any) => {
    await tx`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`;
    const operations = await tx`
      SELECT p.work_center_code, c.name AS center_name, p.active_seconds, p.started_at
      FROM production_operations p
      JOIN work_orders w ON w.id=p.work_order_id AND w.tenant_id=p.tenant_id AND w.tenant_id=${t}
      LEFT JOIN work_centers c ON c.code=p.work_center_code AND c.tenant_id=p.tenant_id AND c.tenant_id=${t}
      WHERE p.tenant_id=${t} AND w.category='production' AND p.status='done'
        AND p.completed_at>=${range.from} AND p.completed_at<${range.until}
      ORDER BY p.work_center_code, p.id`;
    const jobs = await tx`
      SELECT completed_at AS "completedAt", due_at AS "dueAt"
      FROM work_orders WHERE tenant_id=${t} AND category='production' AND status='done'
        AND completed_at>=${range.from} AND completed_at<${range.until}`;
    // These stored lengths can use planned remainingMm when no measurement was entered.
    // weight_kg and cost are derived; neither is selected or treated as a measurement.
    const losses = await tx`
      SELECT l.length_mm AS value, 'mm'::text AS unit
      FROM cutting_losses l
      JOIN cutting_plans p ON p.id=l.plan_id AND p.tenant_id=l.tenant_id AND p.tenant_id=${t}
      WHERE l.tenant_id=${t} AND p.status='completed'
        AND p.completed_at>=${range.from} AND p.completed_at<${range.until}`;
    const centers = new Map<string, { code: string; name: string; completed: number; durations: unknown[] }>();
    for (const op of operations) {
      const center: { code: string; name: string; completed: number; durations: unknown[] } = centers.get(op.work_center_code) || { code: op.work_center_code, name: op.center_name || op.work_center_code, completed: 0, durations: [] };
      center.completed++;
      // Default zero without a recorded start is not evidence of a measured duration.
      if (op.started_at) center.durations.push(op.active_seconds);
      centers.set(center.code, center);
    }
    return {
      centers: [...centers.values()].map(({ durations, ...center }) => ({ ...center, active: medianActiveSeconds(durations) })),
      deadlines: deadlineCounts(jobs), completedJobs: jobs.length,
      calculatedLosses: lossByUnit(losses), measuredLossSamples: 0,
    };
  });
}
