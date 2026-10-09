import { redactedJson } from '@/lib/security/field-access.server';
import { AuthenticationError, getServerUserContext } from '@/lib/features/auth/serverAuth';
import { searchWorkspace } from '@/lib/features/search/workspace-search';

/** GET /api/v1/search/all?q= — orders, customers, quotations and stock the role may open. */
export async function GET(request: Request) {
  try {
    const context = await getServerUserContext();
    const query = new URL(request.url).searchParams.get('q') || '';
    const result = await searchWorkspace({ tenantId: context.tenantId, userId: context.userId, role: context.role }, query);
    return redactedJson(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthenticationError) return redactedJson({ error: 'Oturum gerekli.' }, { status: 401 });
    console.error('[Search]', error);
    return redactedJson({ error: 'Arama şu anda yapılamadı.' }, { status: 500 });
  }
}
