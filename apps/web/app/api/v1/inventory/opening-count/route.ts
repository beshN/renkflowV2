import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { openingCountOverview, recordOpeningCount } from '@/lib/features/warehouse/count-import/opening';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

function error(e: unknown) {
  if (e instanceof WorkOrderApiError) return NextResponse.json({ error: e.message }, { status: e.status, headers });
  if (e instanceof ZodError) return NextResponse.json({ error: e.issues.map((i) => i.message).join(', ') }, { status: 400, headers });
  console.error('[opening count]', e instanceof Error ? e.message : 'failed');
  return NextResponse.json({ error: 'Açılış sayımı kaydedilemedi.' }, { status: 500, headers });
}

export async function GET() {
  try {
    const { sql } = await import('@/lib/db');
    const [ready] = await sql`SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='stock_count_lines' AND column_name='counted_meters') AS ok`;
    if (!ready?.ok) return NextResponse.json({ available: false }, { headers });
    return NextResponse.json({ available: true, ...(await openingCountOverview(await requireWorkOrderActor())) }, { headers });
  } catch (e) {
    return error(e);
  }
}

/** POST { commandId, data }: the counted bars of one profile and colour. */
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 100_000);
    const body = commandBody(await req.json());
    return NextResponse.json({ data: await recordOpeningCount(await requireWorkOrderActor(), body.data, body.commandId) }, { headers });
  } catch (e) {
    return error(e);
  }
}

function commandBody(raw: unknown) {
  const body = raw as { commandId?: unknown; data?: unknown };
  if (typeof body?.commandId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.commandId)) throw new WorkOrderApiError('Komut anahtarı gerekli', 400);
  return { commandId: body.commandId, data: body.data };
}
