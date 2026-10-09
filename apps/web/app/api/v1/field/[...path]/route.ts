import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { fieldActor, fieldSnapshot, fieldDetails, assertFieldJob, readFieldJson } from '@/lib/features/field/service';
import { WorkOrderApiError, requireWorkOrderPermission } from '@/lib/features/work-orders/security';
import { updateWorkOrder, toggleWorkOrderChecklistItem, addWorkOrderComment, WorkOrderCommentInputSchema, ToggleChecklistInputSchema } from '@/lib/features/work-orders/service';
import { productionCommand } from '@/lib/features/manufacturing/platform.service';
import { OperationCommandSchema } from '@/lib/features/manufacturing/platform-contract';
import { storeProductionFile } from '@/lib/features/manufacturing/files.service';
import { resolveLabel } from '@/lib/features/warehouse/service';
import { requireSameOrigin } from '@/lib/features/manufacturing/http-security';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path: string[] }> };
const TransitionSchema = z.object({
  status: z.enum(['open', 'in_progress', 'blocked', 'done', 'cancelled']),
  blockedReasonCategory: z.enum(['material', 'machine', 'planning', 'manpower', 'quality', 'other']).optional(),
  blockedReasonDetail: z.string().trim().min(5).max(1000).optional(),
}).strict();
const CommandSchema = z.object({ commandId: z.string().uuid(), action: z.literal('operation'), data: OperationCommandSchema }).strict();
function ok(data: unknown) { return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'private, no-store' } }); }
function failure(error: unknown) {
  if (error instanceof WorkOrderApiError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ success: false, error: error.issues.map(issue => issue.message).join(', ') }, { status: 400 });
  console.error('[field-api] Request failed', error instanceof Error ? error.name : 'unknown');
  return NextResponse.json({ success: false, error: 'İşlem tamamlanamadı. Güncel kaydı yenileyip tekrar deneyin.' }, { status: 409 });
}
export async function GET(request: NextRequest, context: Context) {
  try {
    const actor = await fieldActor(request), { path } = await context.params;
    if (path.length === 1 && path[0] === 'snapshot') return ok(await fieldSnapshot(actor));
    if (path.length === 2 && path[0] === 'work-orders') return ok(await fieldDetails(actor, path[1]));
    if (path.length === 1 && path[0] === 'scan') {
      const result = await resolveLabel(actor, request.nextUrl.searchParams.get('code') || '');
      return ok({ kind: result.kind, id: result.id, workOrderId: result.workOrderId || (result.kind === 'job' ? result.id : null), title: result.title, subtitle: result.subtitle || result.summary || null, quantity: result.quantity ?? null, uom: result.uom || null, code: result.code || null });
    }
    throw new WorkOrderApiError('Uç nokta bulunamadı.', 404);
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    requireSameOrigin(request);
    const actor = await fieldActor(request), { path } = await context.params;
    if (path.length === 1 && path[0] === 'commands') {
      const command = CommandSchema.parse(await readFieldJson(request));
      // Production service enforces operation assignment, version, quantity and quality checks.
      const result = await productionCommand(actor, command);
      return ok({ accepted: true, qualityRejected: result.qualityRejected === true });
    }
    if (path.length === 1 && path[0] === 'files') {
      // Base64 plus envelope stays under Vercel's 4.5 MB request limit.
      const input = z.object({ name: z.string().min(1).max(180), mime: z.literal('image/jpeg'), base64: z.string().max(2_800_000), workOrderId: z.string().uuid() }).strict().parse(await readFieldJson(request, 2_900_000));
      await assertFieldJob(actor, input.workOrderId);
      return ok(await storeProductionFile(actor, input));
    }
    if (path.length === 3 && path[0] === 'work-orders' && path[2] === 'comments') {
      await assertFieldJob(actor, path[1]); requireWorkOrderPermission(actor, 'comment');
      const input = WorkOrderCommentInputSchema.parse(await readFieldJson(request));
      await addWorkOrderComment(actor, path[1], input.body);
      return ok({ accepted: true });
    }
    if (path.length === 4 && path[0] === 'work-orders' && path[2] === 'checklist') {
      await assertFieldJob(actor, path[1]); requireWorkOrderPermission(actor, 'checklist');
      const id = z.string().uuid().parse(path[3]);
      const input = ToggleChecklistInputSchema.parse(await readFieldJson(request));
      await toggleWorkOrderChecklistItem(actor, path[1], id, input.completed);
      return ok({ accepted: true });
    }
    if (path.length === 3 && path[0] === 'work-orders' && path[2] === 'transition') {
      const record = await assertFieldJob(actor, path[1]); requireWorkOrderPermission(actor, 'transition');
      if (record.recipe_id) throw new WorkOrderApiError('Üretim emrini operasyon adımları üzerinden ilerletin.', 409);
      const input = TransitionSchema.parse(await readFieldJson(request));
      if (['done', 'cancelled'].includes(input.status)) requireWorkOrderPermission(actor, 'close');
      await updateWorkOrder(actor, path[1], input);
      return ok({ accepted: true });
    }
    throw new WorkOrderApiError('Uç nokta bulunamadı.', 404);
  } catch (error) { return failure(error); }
}
