import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { customerPriceRules, deletePriceRule, salesAvailable, savePriceRule } from '@/lib/features/sales/quotes.server';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };
const READERS = ['owner', 'admin', 'office', 'accountant'];

/** A customer's standing discounts (general or per product family), applied to new quotes. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const actor = await requireWorkOrderActor();
    if (!READERS.includes(actor.role)) throw new WorkOrderApiError('Müşteri fiyat listesini görme yetkiniz yok', 403);
    const id = z.string().uuid().parse((await params).id);
    return NextResponse.json({ available: await salesAvailable(), rules: await customerPriceRules(actor.tenantId, id) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'price-rules');
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    requireSameOriginJson(req, 2_000);
    const id = z.string().uuid().parse((await params).id);
    return NextResponse.json({ available: true, rules: await savePriceRule(await requireWorkOrderActor(), id, await req.json()) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'price-rules');
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    requireSameOriginJson(req, 1_000);
    const id = z.string().uuid().parse((await params).id);
    const rule = z.string().uuid().parse(req.nextUrl.searchParams.get('rule'));
    return NextResponse.json({ available: true, rules: await deletePriceRule(await requireWorkOrderActor(), id, rule) }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'price-rules');
  }
}
