import { redactedJson } from '@/lib/security/field-access.server';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createBom } from '@/lib/features/manufacturing/bom.service';
import { CreateBomInputSchema } from '@/lib/features/manufacturing/types';
import {
  requireWorkOrderActor,
  requireWorkOrderPermission,
  WorkOrderApiError,
} from '@/lib/features/work-orders/security';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireWorkOrderActor();
    requireWorkOrderPermission(actor, 'create');
    const parsed = CreateBomInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return redactedJson({ error: 'Invalid payload', details: z.flattenError(parsed.error) }, { status: 400 });
    }
    return redactedJson({ success: true, data: await createBom(actor, parsed.data) }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkOrderApiError) return redactedJson({ error: error.message }, { status: error.status });
    console.error('BOM create error:', error);
    return redactedJson({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 400 });
  }
}
