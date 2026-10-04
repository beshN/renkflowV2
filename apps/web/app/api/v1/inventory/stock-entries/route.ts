import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { postStockEntry } from '@/lib/features/manufacturing/inventory.service';
import { PostStockEntryInputSchema } from '@/lib/features/manufacturing/types';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import {
  requireWorkOrderActor,
  WorkOrderApiError,
} from '@/lib/features/work-orders/security';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireWorkOrderActor();
    if (!['owner', 'admin'].includes(actor.role)) throw new WorkOrderApiError('Stok düzeltmesini firma yöneticisi onaylamalıdır', 403);
    requireSameOriginJson(request);
    const parsed = PostStockEntryInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: z.flattenError(parsed.error) }, { status: 400 });
    }
    const input = parsed.data;
    if (!['MATERIAL_RECEIPT', 'STOCK_RECONCILIATION'].includes(input.entryType) || input.referenceType || input.referenceId || input.lines.some(line => line.lotId || line.uom === 'm')) {
      throw new WorkOrderApiError('Profil ve üretime bağlı stok hareketlerini mal kabul, kesim veya üretim ekranından kaydedin', 409);
    }
    if (!input.note || input.note.trim().length < 5) throw new WorkOrderApiError('Stok kaydı için açıklayıcı bir gerekçe gereklidir', 400);
    return NextResponse.json({ success: true, data: await postStockEntry(actor, parsed.data) }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkOrderApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Stock entry error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 400 });
  }
}
