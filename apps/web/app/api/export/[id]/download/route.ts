import { hidesAny, redactedJson } from '@/lib/security/field-access.server';
import { NextRequest, NextResponse } from 'next/server';
import { apiContextWithPermission } from '@/lib/features/auth/api-access';
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
    const { context, denied } = await apiContextWithPermission('reports.view');
    if (denied) return denied;
    // A full export carries prices and contacts; a role that hides any of them gets none.
    if (await hidesAny(['price', 'cost', 'profit', 'customer_contact'])) return redactedJson({ error: 'Rolünüz bu dışa aktarımı içermez.' }, { status: 403 });

    const rateLimitResult = await consumeRateLimit('exportRead', context.userId);
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult);
    }

    const { id } = await params;
    const download = await getExportDownload(id, context.tenantId);
    if (!download) {
      return redactedJson({ error: 'Not found' }, { status: 404 });
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
      return redactedJson({ error: 'Not found' }, { status: 404 });
    }
    console.error('[api/export/[id]/download] Unexpected error:', error);
    return redactedJson({ error: 'Internal Server Error' }, { status: 500 });
  }
}
