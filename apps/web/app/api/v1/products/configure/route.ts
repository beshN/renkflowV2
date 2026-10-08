import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { configurationOptions, previewConfiguration } from '@/lib/features/products/configure.service';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

function error(e: unknown) {
  if (e instanceof WorkOrderApiError) return NextResponse.json({ error: e.message }, { status: e.status, headers });
  if (e instanceof ZodError) return NextResponse.json({ error: e.issues.map((i) => i.message).join(', ') }, { status: 400, headers });
  console.error('[configure]', e instanceof Error ? e.message : 'failed');
  return NextResponse.json({ error: 'Ürün yapılandırılamadı.' }, { status: 500, headers });
}

/** GET ?family=pergola: published recipes, colours and price matrix state for the configurator. */
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await configurationOptions(await requireWorkOrderActor(), req.nextUrl.searchParams.get('family') || 'pergola'), { headers });
  } catch (e) {
    return error(e);
  }
}

/** POST { currency, choice }: bill of materials, cut list and price (or why there is none) for one product. */
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 50_000);
    return NextResponse.json({ data: await previewConfiguration(await requireWorkOrderActor(), await req.json()) }, { headers });
  } catch (e) {
    return error(e);
  }
}
