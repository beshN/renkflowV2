import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getExportDownload } from '@/lib/export/service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      'Content-Disposition': `attachment; filename="${download.filename}"`,
    },
  });
}
