import { NextRequest, NextResponse } from 'next/server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { saveRole } from '@/lib/security/team.server';
import { RoleBody } from './schema';

export const dynamic = 'force-dynamic';

/** New custom role (module × action matrix and hidden fields, within its base role). */
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 20_000);
    const actor = await requireWorkOrderActor();
    const id = await saveRole(actor, null, RoleBody.parse(await req.json()));
    return NextResponse.json({ id }, { status: 201, headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'team-roles');
  }
}
