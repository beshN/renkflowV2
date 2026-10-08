import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { colorCatalogSettings, saveColorCatalog } from '@/lib/features/settings/color-catalog.service';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

function error(e: unknown) {
  if (e instanceof WorkOrderApiError) return NextResponse.json({ error: e.message }, { status: e.status, headers });
  if (e instanceof ZodError) return NextResponse.json({ error: e.issues.map((i) => i.message).join(', ') }, { status: 400, headers });
  if (e instanceof SyntaxError) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400, headers });
  console.error('[color catalog]', e instanceof Error ? e.message : 'failed');
  return NextResponse.json({ error: 'Renk kataloğu işlenemedi.' }, { status: 500, headers });
}

export async function GET() {
  try {
    return NextResponse.json(await colorCatalogSettings(await requireWorkOrderActor()), { headers });
  } catch (e) {
    return error(e);
  }
}

/** PUT { colors: string[] } replaces the catalogue in the given order. */
export async function PUT(req: NextRequest) {
  try {
    requireSameOriginJson(req, 20_000);
    return NextResponse.json(await saveColorCatalog(await requireWorkOrderActor(), await req.json()), { headers });
  } catch (e) {
    return error(e);
  }
}
