import { NextRequest } from 'next/server';
import { z } from 'zod';
import { stationDevice } from '@/lib/features/stations/security.server';
import { stationFile } from '@/lib/features/stations/service.server';
import { workspaceError } from '@/lib/security/workspace-response';
export async function GET(req: NextRequest) {
  try {
    const kind = z
      .enum(['production', 'knowledge'])
      .parse(req.nextUrl.searchParams.get('kind'));
    const f = await stationFile(
      await stationDevice(req),
      kind,
      req.nextUrl.searchParams.get('id') ?? '',
    );
    const inline = f.mime === 'application/pdf' || f.mime.startsWith('image/');
    return new Response(f.body, {
      headers: {
        'Content-Type': f.mime,
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name).replace(/'/g, '%27')}`,
      },
    });
  } catch (e) {
    return workspaceError(e);
  }
}
