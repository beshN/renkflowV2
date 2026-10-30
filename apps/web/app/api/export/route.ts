import { hidesAny, redactedJson } from '@/lib/security/field-access.server';
import { apiContextWithPermission } from '@/lib/features/auth/api-access';
import { createExportJob, getExportJob, listExportJobs } from '@/lib/export/service';
import { consumeRateLimit, rateLimitResponse } from '@/lib/security/rate-limit';
import { z } from 'zod';
import { isMissingRelationError } from '@/lib/db/schema-guard';
import { crossOriginRejection } from '@/lib/features/manufacturing/http-security';

const ExportOptionsSchema = z.object({
  format: z.enum(['csv', 'pdf']),
  entityType: z.enum(['orders', 'customers', 'analytics']),
  dateRange: z
    .object({
      start: z.coerce.date(),
      end: z.coerce.date(),
    })
    .optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  columns: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const crossOrigin = crossOriginRejection(request);
  if (crossOrigin) return crossOrigin;
  try {
    const { context, denied } = await apiContextWithPermission('reports.export');
    if (denied) return denied;
    if (await hidesAny(['price', 'cost', 'profit', 'customer_contact'])) return redactedJson({ error: 'Rolünüz bu dışa aktarımı içermez.' }, { status: 403 });

    const rateLimitResult = await consumeRateLimit('exportCreate', context.userId);
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult);
    }

    const body = await request.json().catch(() => null);
    const parsed = ExportOptionsSchema.safeParse(body);
    if (!parsed.success) {
      return redactedJson({ error: 'Invalid request' }, { status: 400 });
    }

    const job = await createExportJob(context.tenantId, context.userId, parsed.data);
    return redactedJson({ success: true, job });
  } catch (error) {
    if (isMissingRelationError(error, ['export_jobs'])) {
      return redactedJson(
        { error: 'Export modülü henüz veritabanında aktif değil' },
        { status: 503 }
      );
    }
    console.error('[api/export POST] Unexpected error:', error);
    return redactedJson({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { context, denied } = await apiContextWithPermission('reports.export');
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('id');

    const rateLimitResult = await consumeRateLimit('exportRead', context.userId);
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult);
    }

    if (jobId) {
      if (jobId.length > 200) {
        return redactedJson({ error: 'Bad request' }, { status: 400 });
      }
      const job = await getExportJob(jobId, context.tenantId);
      if (!job) return redactedJson({ error: 'Not found' }, { status: 404 });
      return redactedJson({ success: true, job });
    }

    const jobs = await listExportJobs(context.tenantId, 20);
    return redactedJson({ success: true, jobs });
  } catch (error) {
    if (isMissingRelationError(error, ['export_jobs'])) {
      return redactedJson({ success: true, jobs: [] });
    }
    console.error('[api/export GET] Unexpected error:', error);
    return redactedJson({ error: 'Internal Server Error' }, { status: 500 });
  }
}
