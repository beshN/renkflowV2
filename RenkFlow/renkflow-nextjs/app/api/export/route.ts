import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createExportJob, getExportJob, listExportJobs } from '@/lib/export/service';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.tenantId || !session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const job = await createExportJob(session.user.tenantId, session.user.id, body);
  return NextResponse.json({ success: true, job });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('id');

  if (jobId) {
    const job = await getExportJob(jobId);
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, job });
  }

  const jobs = await listExportJobs(session.user.tenantId, 20);
  return NextResponse.json({ success: true, jobs });
}
