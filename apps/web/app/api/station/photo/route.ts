import { NextRequest } from 'next/server';
import { stationDevice } from '@/lib/features/stations/security.server';
import { stationPhoto } from '@/lib/features/stations/service.server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import {
  workspaceJson,
  workspaceError,
} from '@/lib/security/workspace-response';
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 3_100_000);
    return workspaceJson(
      await stationPhoto(await stationDevice(req), await req.json()),
    );
  } catch (e) {
    return workspaceError(e);
  }
}
