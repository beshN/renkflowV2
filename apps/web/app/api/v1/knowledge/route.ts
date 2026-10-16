import { NextRequest } from 'next/server';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import {
  listKnowledge,
  saveKnowledge,
} from '@/lib/features/knowledge/service.server';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import {
  workspaceJson,
  workspaceError,
} from '@/lib/security/workspace-response';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams;
    return workspaceJson(
      await listKnowledge(await requireWorkOrderActor(), {
        q: p.get('q') ?? '',
        category: p.get('category') ?? '',
        archived: p.get('archived') === '1',
      }),
    );
  } catch (e) {
    return workspaceError(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 15_000_000);
    return workspaceJson(
      await saveKnowledge(await requireWorkOrderActor(), await req.json()),
    );
  } catch (e) {
    return workspaceError(e);
  }
}
