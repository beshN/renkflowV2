import { sql } from '@/lib/db';
import { recordAuditAfterCommit } from '@/lib/audit/audit-log';
import { tenantExportStream } from '@/lib/features/account/export.server';
import { recordError } from '@/lib/features/records/http';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { consumeRateLimit, rateLimitResponse } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Every row of the firm as a ZIP of CSVs (KVKK m.11, veri taşınabilirliği). Owner only. A GET
 * download: nothing changes besides the rate-limit counter and the audit entries.
 */
export async function GET() {
  try {
    const actor = await requireWorkOrderActor();
    if (actor.role !== 'owner') throw new WorkOrderApiError('Tüm verileri yalnız firma sahibi indirebilir', 403);
    const limit = await consumeRateLimit('tenantExport', `${actor.tenantId}:${actor.userId}`);
    if (!limit.allowed) return rateLimitResponse(limit, 'Veri dökümü saatte en fazla 3 kez alınabilir. Lütfen biraz sonra tekrar deneyin.');

    const now = new Date();
    const audit = { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'tenant', entityId: actor.tenantId };
    await recordAuditAfterCommit({ ...audit, action: 'tenant_export_started', metadata: { format: 'zip' } });
    const stream = tenantExportStream(sql, actor.tenantId, {
      now,
      onDone: (summary) => {
        if (!summary) return;
        void recordAuditAfterCommit({
          ...audit,
          action: 'tenant_exported',
          metadata: {
            tables: summary.plan.tables.length,
            rows: Object.values(summary.rowCounts).reduce((a, b) => a + b, 0),
            files: summary.fileCount,
            excluded: summary.plan.excluded.map((e) => e.table),
          },
        });
      },
    });
    const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(now);
    return new Response(stream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="renkflow-firma-verileri-${day}.zip"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return recordError(e, 'tenant-export');
  }
}
