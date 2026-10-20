import { NextRequest } from 'next/server';
import { stationDevice } from '@/lib/features/stations/security.server';
import { stationOverview } from '@/lib/features/stations/service.server';
import {
  workspaceJson,
  workspaceError,
} from '@/lib/security/workspace-response';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    return workspaceJson(
      await stationOverview(
        await stationDevice(req),
        req.nextUrl.searchParams.get('q') ?? '',
      ),
    );
  } catch (e) {
    return workspaceError(e);
  }
}
