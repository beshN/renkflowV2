import { NextRequest, NextResponse } from 'next/server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { attachmentForDownload } from '@/lib/features/records/service';
import { recordError } from '@/lib/features/records/http';
import { readFile } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/** Streams a record attachment to someone who may open the record. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const file = await attachmentForDownload(await requireWorkOrderActor(), id);
    const content = await readFile(file.key);
    const inline = file.mime.startsWith('image/') || file.mime === 'application/pdf';
    return new NextResponse(content.body, {
      headers: {
        'Content-Type': file.mime,
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return recordError(e, 'attachment');
  }
}
