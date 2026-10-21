import { NextRequest } from 'next/server';
import { z } from 'zod';
import { readFile } from '@/lib/storage';
import {
  requireWorkOrderActor,
  WorkOrderApiError,
} from '@/lib/features/work-orders/security';
import { readKnowledge } from '@/lib/features/knowledge/service.server';
import { workspaceError } from '@/lib/security/workspace-response';
export const dynamic = 'force-dynamic';
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const version = req.nextUrl.searchParams.get('version');
    const data = await readKnowledge(
      await requireWorkOrderActor(),
      (await ctx.params).id,
      version ? z.coerce.number().int().positive().parse(version) : undefined,
    );
    if (!data.fileKey) throw new WorkOrderApiError('Dosya bulunamadı.', 404);
    const f = await readFile(data.fileKey),
      preview =
        req.nextUrl.searchParams.get('download') !== '1' &&
        (data.revision.mime === 'application/pdf' ||
          data.revision.mime.startsWith('image/'));
    const name = encodeURIComponent(data.revision.file_name).replace(
      /'/g,
      '%27',
    );
    return new Response(f.body, {
      headers: {
        'Content-Type': data.revision.mime,
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Disposition': `${preview ? 'inline' : 'attachment'}; filename*=UTF-8''${name}`,
      },
    });
  } catch (e) {
    return workspaceError(e);
  }
}
