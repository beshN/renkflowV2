import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest } from 'next/server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { getRecord, recordCommand } from '@/lib/features/records/service';
import { NO_STORE, recordError } from '@/lib/features/records/http';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ type: string; id: string }> };

/** The record drawer: head, smart buttons, tags, owner, checklist, activities and timeline. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { type, id } = await params;
    return redactedJson(await getRecord(await requireWorkOrderActor(), type, id), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'get');
  }
}

/** One change: { action: 'comment.add' | 'tags.set' | 'checklist.toggle' | ... } (see RecordCommandSchema). */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    // Attachments may come inline (local storage): up to 5 files of 10 MB in base64.
    requireSameOriginJson(req, 70_000_000);
    const { type, id } = await params;
    return redactedJson(await recordCommand(await requireWorkOrderActor(), type, id, await req.json()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'command');
  }
}
