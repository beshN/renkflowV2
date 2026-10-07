import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthenticationError, getServerUserContext } from '@/lib/features/auth/serverAuth';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { UUID_PATTERN } from '@/lib/audit/audit-log';
import { decideSuggestion, suggestionsAvailable } from '@/lib/ai/suggestions/service';

/** POST /api/v1/ai/suggestions/:id — { action: approve | reject | edit, expectedVersion, payload?, note? } */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOriginJson(req, 50_000);
    const context = await getServerUserContext();
    const { id } = await params;
    if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Öneri bulunamadı.' }, { status: 404 });
    if (!(await suggestionsAvailable())) return NextResponse.json({ error: 'Öneriler bu kurulumda henüz açık değil.' }, { status: 404 });
    const result = await decideSuggestion({ tenantId: context.tenantId, userId: context.userId, role: context.role }, id, await req.json());
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: 'Oturum gerekli.' }, { status: 401 });
    if (error instanceof WorkOrderApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Geçersiz karar veya değer.' }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Geçersiz JSON.' }, { status: 400 });
    console.error('[AI suggestions]', error);
    return NextResponse.json({ error: 'Karar kaydedilemedi.' }, { status: 500 });
  }
}
