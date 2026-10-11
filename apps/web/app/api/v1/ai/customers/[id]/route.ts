import { NextRequest } from 'next/server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { customerMemoryFor } from '@/lib/ai/insight/customer-memory.server';

export const dynamic = 'force-dynamic';

/** "Bu müşteri hakkında bildiklerimiz": facts from records, each with its source. Read only. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkOrderActor();
    return redactedJson(await customerMemoryFor(actor, (await params).id), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'ai-customer-memory');
  }
}
