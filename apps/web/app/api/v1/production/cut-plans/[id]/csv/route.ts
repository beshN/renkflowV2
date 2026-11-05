import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { exportCuttingList } from '@/lib/features/manufacturing/cutting-list-export.server';
import { redactedJson } from '@/lib/security/field-access.server';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireWorkOrderActor();
    const { id } = await params;
    const csv = await exportCuttingList(actor, id);
    return new Response(csv, { headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="kesim-listesi-${id}.csv"`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) {
    if (error instanceof WorkOrderApiError) return redactedJson({ error: error.message }, { status: error.status });
    return redactedJson({ error: 'Kesim listesi dışa aktarılamadı.' }, { status: 500 });
  }
}
