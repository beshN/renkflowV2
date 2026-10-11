import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { listInstallations, planInstallation } from '@/lib/features/field/installations.server';

export const dynamic = 'force-dynamic';

/** Installations in ?from=&to= with crew conflicts; the field crew sees only its own. */
export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams;
    return redactedJson(await listInstallations(await requireWorkOrderActor(), { from: p.get('from'), to: p.get('to') }), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'installations');
  }
}

/** Plan an order's installation: { orderId, date?, startTime?, durationMinutes?, crew?, crewName?, address? } */
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 20_000);
    const { orderId, ...rest } = (await req.json()) as { orderId?: string } & Record<string, unknown>;
    return redactedJson(await planInstallation(await requireWorkOrderActor(), z.string().uuid().parse(orderId), rest), { status: 201, headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'installations');
  }
}
