import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { consumeRateLimit, getClientIp, rateLimitResponse } from '@/lib/security/rate-limit';
import { fairTenantId } from '@/lib/features/fair/config';
import { publicJson } from '../http';

export const dynamic = 'force-dynamic';

/**
 * The configurator's own health: the firm exists and (with ?fair=<code>) that fair is active. The ERP's
 * /api/health/ready stays green with a wrong FAIR_TENANT_ID; monitor this before and during a fair.
 * Answers only yes/no, never names or ids.
 */
export async function GET(req: NextRequest) {
  const limit = await consumeRateLimit('fairDesignRead', getClientIp(req.headers));
  if (!limit.allowed) return rateLimitResponse(limit);
  const tenantId = fairTenantId();
  if (!tenantId) return publicJson({ status: 'off' }, 503);
  const code = req.nextUrl.searchParams.get('fair');
  try {
    const [row] = await sql`
      SELECT EXISTS (SELECT 1 FROM tenants WHERE id = ${tenantId}) AS firm,
             (SELECT count(*)::int FROM fairs WHERE tenant_id = ${tenantId} AND active) AS active_fairs,
             (SELECT EXISTS (SELECT 1 FROM fairs WHERE tenant_id = ${tenantId} AND active AND code = ${code ?? ''})) AS fair`;
    const problems = [!row.firm && 'firm_missing', code && !row.fair && 'fair_not_active'].filter(Boolean);
    return publicJson({ status: problems.length ? 'misconfigured' : 'ready', problems, activeFairs: Number(row.active_fairs) }, problems.length ? 503 : 200);
  } catch {
    return publicJson({ status: 'database_unavailable' }, 503);
  }
}
