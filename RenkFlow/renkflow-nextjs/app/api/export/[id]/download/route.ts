import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getExportDownload } from '@/lib/export/service';
import { exportRateLimiter, createRateLimitResponse } from '@/lib/rateLimiter';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function sanitizeDownloadFilename(filename: string): string {
  return filename
    .replace(/[\r\n]/g, '')
    .replace(/"/g, '')
    .slice(0, 200);
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimitResult = await exportRateLimiter.check(_request, 'download');
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult);
  }

  const { id } = await params;
  const download = await getExportDownload(id, session.user.tenantId);
  if (!download) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const arrayBuffer = download.content.buffer.slice(
    download.content.byteOffset,
    download.content.byteOffset + download.content.byteLength
  ) as ArrayBuffer;
  const body = new Blob([arrayBuffer]);

  return new NextResponse(body, {
    headers: {
      'Content-Type': download.contentType,
      'Content-Disposition': `attachment; filename="${sanitizeDownloadFilename(download.filename)}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
