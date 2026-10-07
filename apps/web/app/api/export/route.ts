import { NextResponse } from 'next/server';
import { apiContextWithPermission } from '@/lib/features/auth/api-access';
import { createExportJob, getExportJob, listExportJobs } from '@/lib/export/service';
import { consumeRateLimit, rateLimitResponse } from '@/lib/security/rate-limit';
import { z } from 'zod';
import { isMissingRelationError } from '@/lib/db/schema-guard';

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
  try {
    const { context, denied } = await apiContextWithPermission('reports.view');
    if (denied) return denied;

    const rateLimitResult = await consumeRateLimit('exportCreate', context.userId);
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult);
    }

    const body = await request.json().catch(() => null);
    const parsed = ExportOptionsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const job = await createExportJob(context.tenantId, context.userId, parsed.data);
    return NextResponse.json({ success: true, job });
  } catch (error) {
    if (isMissingRelationError(error, ['export_jobs'])) {
      return NextResponse.json(
        { error: 'Export modülü henüz veritabanında aktif değil' },
        { status: 503 }
      );
    }
    console.error('[api/export POST] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { context, denied } = await apiContextWithPermission('reports.view');
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('id');

    const rateLimitResult = await consumeRateLimit('exportRead', context.userId);
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult);
    }

    if (jobId) {
      if (jobId.length > 200) {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 });
      }
      const job = await getExportJob(jobId, context.tenantId);
      if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ success: true, job });
    }

    const jobs = await listExportJobs(context.tenantId, 20);
    return NextResponse.json({ success: true, jobs });
  } catch (error) {
    if (isMissingRelationError(error, ['export_jobs'])) {
      return NextResponse.json({ success: true, jobs: [] });
    }
    console.error('[api/export GET] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
