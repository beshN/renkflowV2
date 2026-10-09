import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest } from 'next/server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireProcurementWrite } from '@/lib/features/manufacturing/purchasing.service';
import { z } from 'zod';
import { submitGoodsReceipt } from '@/lib/features/manufacturing/procurement.service';
import { GoodsReceiptInputSchema } from '@/lib/features/manufacturing/types';
import {
  requireWorkOrderActor,
  requireWorkOrderPermission,
  WorkOrderApiError,
} from '@/lib/features/work-orders/security';

export async function POST(request: NextRequest) {
  try {
    requireSameOriginJson(request, 100000);
    const actor = await requireWorkOrderActor();
    requireProcurementWrite(actor);
    const parsed = GoodsReceiptInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return redactedJson({ error: 'Invalid payload', details: z.flattenError(parsed.error) }, { status: 400 });
    }
    return redactedJson({ success: true, data: await submitGoodsReceipt(actor, parsed.data) }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkOrderApiError) return redactedJson({ error: error.message }, { status: error.status });
    console.error('Goods receipt error:', error);
    return redactedJson({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 400 });
  }
}
