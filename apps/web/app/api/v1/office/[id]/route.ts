import { after, NextRequest } from 'next/server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { actOnOfficeTask } from '@/lib/features/office/service.server';
import { runOfficeTask } from '@/lib/features/office/runner.server';
import { workspaceError, workspaceJson } from '@/lib/security/workspace-response';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Approve, send back with a note, answer a raised hand or retry; the last three run the task again. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    requireSameOriginJson(req, 10_000);
    const actor = await requireWorkOrderActor();
    const { id } = await ctx.params;
    const { run } = await actOnOfficeTask(actor, id, await req.json());
    if (run) after(() => runOfficeTask(actor.tenantId, id));
    return workspaceJson({ ok: true });
  } catch (e) {
    return workspaceError(e);
  }
}
