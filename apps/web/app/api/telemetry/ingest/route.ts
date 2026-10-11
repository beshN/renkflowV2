import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { ingestTelemetry } from '@/lib/features/fleet/fleet.server';

export const dynamic = 'force-dynamic';

/**
 * Device positions (ADR 0003). Public: the device token (Authorization: Bearer …) is the key; rate
 * limited per device; body { positions: [{ t, lat, lng, speed?, heading?, ignition?, odometer? }] }.
 */
export async function POST(req: NextRequest) {
  try {
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return NextResponse.json({ error: 'JSON isteği gerekli' }, { status: 415 });
    if (Number(req.headers.get('content-length')) > 300_000) return NextResponse.json({ error: 'İstek çok büyük' }, { status: 413 });
    const token = req.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;
    return NextResponse.json(await ingestTelemetry(token, await req.json()), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'telemetry');
  }
}
