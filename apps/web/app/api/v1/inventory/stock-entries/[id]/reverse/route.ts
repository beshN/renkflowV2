import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { reverseStockEntry } from '@/lib/features/manufacturing/inventory.service';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import {
  requireWorkOrderActor,
  WorkOrderApiError,
} from '@/lib/features/work-orders/security';

const BodySchema = z.object({ idempotencyKey: z.string().trim().min(8).max(160) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireWorkOrderActor();
    if (!['owner', 'admin'].includes(actor.role)) throw new WorkOrderApiError('Stok düzeltmesini firma yöneticisi onaylamalıdır', 403);
    requireSameOriginJson(request);
    const { id } = await params;
    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) return redactedJson({ error: 'Invalid payload' }, { status: 400 });
    return redactedJson({ success: true, data: await reverseStockEntry(actor, id, parsed.data.idempotencyKey) });
  } catch (error) {
    if (error instanceof WorkOrderApiError) return redactedJson({ error: error.message }, { status: error.status });
    console.error('Stock reversal error:', error);
    return redactedJson({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 400 });
  }
}
