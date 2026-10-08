import { NextRequest, NextResponse } from 'next/server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { deleteTag, listTags, saveTag } from '@/lib/features/records/service';
import { NO_STORE, recordError } from '@/lib/features/records/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ tags: await listTags(await requireWorkOrderActor()) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'tags');
  }
}
/** PUT { id?, name, color }: create or rename. */
export async function PUT(req: NextRequest) {
  try {
    requireSameOriginJson(req, 4_000);
    return NextResponse.json(await saveTag(await requireWorkOrderActor(), await req.json()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'tags');
  }
}
/** DELETE ?id= */
export async function DELETE(req: NextRequest) {
  try {
    requireSameOriginJson(req, 4_000);
    return NextResponse.json(await deleteTag(await requireWorkOrderActor(), req.nextUrl.searchParams.get('id') ?? ''), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'tags');
  }
}
