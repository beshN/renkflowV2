import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { recordError } from '@/lib/features/records/http';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { exportCustomerData } from '@/lib/features/privacy/subject.server';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** Everything held about the customer as a JSON download (KVKK m.11). Owner/admin only. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const id = (await params).id;
    const data = await exportCustomerData(sql, await requireWorkOrderActor(), id);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="kvkk-veri-dokumu-${id.slice(0, 8)}.json"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return recordError(e, 'privacy-export');
  }
}
