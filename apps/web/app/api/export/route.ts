import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createExportJob, getExportJob, listExportJobs } from '@/lib/export/service';
import { exportRateLimiter, createRateLimitResponse } from '@/lib/rateLimiter';
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
    const session = await auth();
    if (!session?.user?.tenantId || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResult = await exportRateLimiter.check(request as any, 'create');
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult);
    }

    const body = await request.json().catch(() => null);
    const parsed = ExportOptionsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const job = await createExportJob(session.user.tenantId, session.user.id, parsed.data);
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
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('id');

    const rateLimitResult = await exportRateLimiter.check(request as any, 'list');
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult);
    }

    if (jobId) {
      if (jobId.length > 200) {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 });
      }
      const job = await getExportJob(jobId, session.user.tenantId);
      if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ success: true, job });
    }

    const jobs = await listExportJobs(session.user.tenantId, 20);
    return NextResponse.json({ success: true, jobs });
  } catch (error) {
    if (isMissingRelationError(error, ['export_jobs'])) {
      return NextResponse.json({ success: true, jobs: [] });
    }
    console.error('[api/export GET] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
