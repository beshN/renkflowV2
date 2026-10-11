import { redactedJson } from '@/lib/security/field-access.server';
import { AuthenticationError, getServerUserContext } from '@/lib/features/auth/serverAuth';
import { listPendingSuggestions, suggestionsAvailable } from '@/lib/ai/suggestions/service';

/** GET /api/v1/ai/suggestions — pending assistant suggestions this role may decide. */
export async function GET() {
  try {
    const context = await getServerUserContext();
    if (!(await suggestionsAvailable())) return redactedJson({ available: false, items: [] }, { headers: { 'Cache-Control': 'private, no-store' } });
    const items = await listPendingSuggestions({ tenantId: context.tenantId, userId: context.userId, role: context.role });
    return redactedJson({ available: true, items }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthenticationError) return redactedJson({ error: 'Oturum gerekli.' }, { status: 401 });
    console.error('[AI suggestions]', error);
    return redactedJson({ error: 'Öneriler alınamadı.' }, { status: 500 });
  }
}
