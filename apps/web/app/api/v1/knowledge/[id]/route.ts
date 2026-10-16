import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import {
  readKnowledge,
  archiveKnowledge,
} from '@/lib/features/knowledge/service.server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import {
  workspaceJson,
  workspaceError,
} from '@/lib/security/workspace-response';
type Context = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, ctx: Context) {
  try {
    const version = req.nextUrl.searchParams.get('version');
    const { fileKey, ...data } = await readKnowledge(
      await requireWorkOrderActor(),
      (await ctx.params).id,
      version ? z.coerce.number().int().positive().parse(version) : undefined,
    );
    return workspaceJson({ ...data, hasFile: Boolean(fileKey) });
  } catch (e) {
    return workspaceError(e);
  }
}
export async function PATCH(req: NextRequest, ctx: Context) {
  try {
    requireSameOriginJson(req, 2000);
    return workspaceJson(
      await archiveKnowledge(
        await requireWorkOrderActor(),
        (await ctx.params).id,
        await req.json(),
      ),
    );
  } catch (e) {
    return workspaceError(e);
  }
}
