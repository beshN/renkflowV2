import { NextRequest } from 'next/server';
import { consumeRateLimit, getClientIp, rateLimitResponse } from '@/lib/security/rate-limit';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { createDesign } from '@/lib/features/fair/designs.server';
import { publicError, publicJson } from '../http';

export const dynamic = 'force-dynamic';

/** Stores a design under its client-made token, or confirms the stored one (kiosk sync is idempotent). */
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 3_000_000);
    const limit = await consumeRateLimit('fairDesignWrite', getClientIp(req.headers));
    if (!limit.allowed) return rateLimitResponse(limit);
    const result = await createDesign(await req.json());
    return publicJson(result, result.created ? 201 : 200);
  } catch (e) {
    return publicError(e, 'fair-design');
  }
}
