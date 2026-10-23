import { readJsonBody } from '@/lib/security/request-body.server';
import { after, NextRequest } from 'next/server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { createOfficeTask, listOfficeTasks } from '@/lib/features/office/service.server';
import { runOfficeTask } from '@/lib/features/office/runner.server';
import { workspaceError, workspaceJson } from '@/lib/security/workspace-response';

export const dynamic = 'force-dynamic';
/** The task runs after the response, within this budget (runner.server.ts stops itself before it). */
export const maxDuration = 300;

export async function GET() {
  try {
    return workspaceJson(await listOfficeTasks(await requireWorkOrderActor()));
  } catch (e) {
    return workspaceError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 20_000);
    const actor = await requireWorkOrderActor();
    const task = await createOfficeTask(actor, await readJsonBody(req, 20_000));
    after(() => runOfficeTask(actor.tenantId, task.id));
    return workspaceJson(task);
  } catch (e) {
    return workspaceError(e);
  }
}
