import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { effectiveRate } from '@/lib/features/fx/rates.server';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';

export const dynamic = 'force-dynamic';

const Query = z.object({
  currency: z.string().regex(/^[A-Za-z]{3}$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** TCMB forex buying rate in force on a day (default: today, Istanbul) for 1 unit of a currency. */
export async function GET(req: NextRequest) {
  try {
    await requireWorkOrderActor();
    const q = Query.parse(Object.fromEntries(req.nextUrl.searchParams));
    const day = q.date ?? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());
    const rate = await effectiveRate(sql, q.currency, day);
    if (!rate) return NextResponse.json({ error: 'Bu tarih için TCMB kuru bulunamadı' }, { status: 404, headers: NO_STORE });
    return NextResponse.json({ ...rate, forDate: day }, { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'fx-rate');
  }
}
