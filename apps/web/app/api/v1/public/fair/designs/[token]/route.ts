import { NextRequest } from 'next/server';
import { consumeRateLimit, getClientIp, rateLimitResponse } from '@/lib/security/rate-limit';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { getDesign, updateDesign } from '@/lib/features/fair/designs.server';
import { publicError, publicJson } from '../../http';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ token: string }> };

/** A design behind its link (no personal data is ever stored on a design). */
export async function GET(req: NextRequest, { params }: Params) {
  const limit = await consumeRateLimit('fairDesignRead', getClientIp(req.headers));
  if (!limit.allowed) return rateLimitResponse(limit);
  const design = await getDesign((await params).token).catch(() => null);
  return design ? publicJson({ design }) : publicJson({ error: 'Bulunamadı' }, 404);
}

/** The link holder's edits. */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    requireSameOriginJson(req, 3_000_000);
    const limit = await consumeRateLimit('fairDesignWrite', getClientIp(req.headers));
    if (!limit.allowed) return rateLimitResponse(limit);
    return publicJson(await updateDesign((await params).token, await req.json()));
  } catch (e) {
    return publicError(e, 'fair-design');
  }
}
