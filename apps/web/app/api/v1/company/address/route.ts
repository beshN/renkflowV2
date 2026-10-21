import { NextRequest } from 'next/server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import {
  companyAddress,
  saveCompanyAddress,
} from '@/lib/features/company/address.server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import {
  workspaceJson,
  workspaceError,
} from '@/lib/security/workspace-response';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return workspaceJson(await companyAddress(await requireWorkOrderActor()));
  } catch (e) {
    return workspaceError(e);
  }
}
export async function PUT(request: NextRequest) {
  try {
    requireSameOriginJson(request, 1000);
    return workspaceJson(
      await saveCompanyAddress(
        await requireWorkOrderActor(),
        await request.json(),
      ),
    );
  } catch (e) {
    return workspaceError(e);
  }
}
