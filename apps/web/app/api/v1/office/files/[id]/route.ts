import { NextRequest } from 'next/server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { readOfficeFile } from '@/lib/features/office/service.server';
import { workspaceError } from '@/lib/security/workspace-response';

export const dynamic = 'force-dynamic';

/** Raster images and PDFs open in the browser; everything else (SVG included) downloads. */
const INLINE = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const file = await readOfficeFile(await requireWorkOrderActor(), (await ctx.params).id);
    const inline = req.nextUrl.searchParams.get('download') !== '1' && INLINE.has(file.contentType);
    const name = encodeURIComponent(file.name).replace(/'/g, '%27');
    return new Response(file.body, {
      headers: {
        'Content-Type': file.contentType,
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${name}`,
      },
    });
  } catch (e) {
    return workspaceError(e);
  }
}
