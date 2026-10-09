import { NextRequest } from 'next/server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { customerStatement } from '@/lib/features/finance/receivables.server';

export const dynamic = 'force-dynamic';

/** Customer statement: ?customer=<key>&from=YYYY-MM-DD&to=YYYY-MM-DD. */
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    return redactedJson(await customerStatement(await requireWorkOrderActor(), q.get('customer') ?? '', q.get('from') ?? '', q.get('to') ?? ''), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'statement');
  }
}
