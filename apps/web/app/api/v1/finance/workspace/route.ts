import { redactedJson } from '@/lib/security/field-access.server';
import { z, ZodError } from 'zod';
import { NextRequest } from 'next/server';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { financeWorkspace } from '@/lib/features/finance/workspace.service';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const actor = await requireWorkOrderActor();
    const employeeId = z.string().uuid().optional().parse(req.nextUrl.searchParams.get('employeeId') || undefined);
    return redactedJson({ data: await financeWorkspace(actor, employeeId) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return redactedJson({ error: error instanceof WorkOrderApiError ? error.message : error instanceof ZodError ? 'Geçerli bir çalışan seçin.' : 'Finans kayıtları alınamadı.' }, {
      status: error instanceof WorkOrderApiError ? error.status : error instanceof ZodError ? 400 : 503,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
