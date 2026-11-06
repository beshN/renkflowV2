import { redactedJson } from '@/lib/security/field-access.server';
import { z } from 'zod';
import { NextRequest } from 'next/server';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { financeWorkspace } from '@/lib/features/finance/workspace.service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const actor = await requireWorkOrderActor();
    const employeeId = z.string().uuid().optional().safeParse(req.nextUrl.searchParams.get('employeeId') ?? undefined);
    if (!employeeId.success) {
      return redactedJson({ error: 'Geçerli bir çalışan kimliği girin.' }, { status: 400 });
    }
    return redactedJson({ data: await financeWorkspace(actor, employeeId.data) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return redactedJson({ error: error instanceof WorkOrderApiError ? error.message : 'Finans kayıtları alınamadı' }, { status: error instanceof WorkOrderApiError ? error.status : 503 });
  }
}
