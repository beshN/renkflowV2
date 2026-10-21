import { NextRequest } from 'next/server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import {
  stationSettings,
  manageStation,
} from '@/lib/features/stations/admin.server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import {
  workspaceJson,
  workspaceError,
} from '@/lib/security/workspace-response';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return workspaceJson(await stationSettings(await requireWorkOrderActor()));
  } catch (e) {
    return workspaceError(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 12_000);
    return workspaceJson(
      await manageStation(await requireWorkOrderActor(), await req.json()),
    );
  } catch (e) {
    return workspaceError(e);
  }
}
