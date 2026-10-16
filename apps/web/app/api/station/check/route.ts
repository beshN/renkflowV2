import { NextRequest } from 'next/server';
import { stationDevice } from '@/lib/features/stations/security.server';
import { saveStationCheck } from '@/lib/features/stations/service.server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import {
  workspaceJson,
  workspaceError,
} from '@/lib/security/workspace-response';
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 4000);
    return workspaceJson(
      await saveStationCheck(await stationDevice(req), await req.json()),
    );
  } catch (e) {
    return workspaceError(e);
  }
}
