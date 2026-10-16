import { NextRequest } from 'next/server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { createKnowledgeCategory } from '@/lib/features/knowledge/service.server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import {
  workspaceJson,
  workspaceError,
} from '@/lib/security/workspace-response';
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 2000);
    return workspaceJson(
      await createKnowledgeCategory(
        await requireWorkOrderActor(),
        await req.json(),
      ),
    );
  } catch (e) {
    return workspaceError(e);
  }
}
