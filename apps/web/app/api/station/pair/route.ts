import { NextRequest } from 'next/server';
import { stationCookieName } from '@/lib/features/stations/contract';
import { secureStationCookie } from '@/lib/features/stations/security.server';
import { pairStation } from '@/lib/features/stations/service.server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import {
  consumeRateLimit,
  getClientIp,
  rateLimitResponse,
} from '@/lib/security/rate-limit';
import {
  workspaceJson,
  workspaceError,
} from '@/lib/security/workspace-response';
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 2000);
    const limit = await consumeRateLimit(
      'stationPair',
      getClientIp(req.headers),
    );
    if (!limit.allowed) return rateLimitResponse(limit);
    const pair = await pairStation(req, await req.json()),
      secure = secureStationCookie(req);
    const response = workspaceJson({ ok: true });
    response.cookies.set(stationCookieName(secure), pair.secret, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/',
      expires: pair.expires,
    });
    return response;
  } catch (e) {
    return workspaceError(e);
  }
}
