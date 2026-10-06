import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getExportDownload } from '@/lib/export/service';
import { consumeRateLimit, rateLimitResponse } from '@/lib/security/rate-limit';
import { isMissingRelationError } from '@/lib/db/schema-guard';

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
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResult = await consumeRateLimit('exportRead', session.user.id || session.user.tenantId);
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult);
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
  } catch (error) {
    if (isMissingRelationError(error, ['export_jobs'])) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('[api/export/[id]/download] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
