import { NextRequest } from 'next/server';
import { redactedJson } from '@/lib/security/field-access.server';
import { sql } from '@/lib/db';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { customerErrorResponse, requireCustomerActor } from '@/lib/features/customers/api';
import { importCustomers } from '@/lib/features/customers/import.server';

export const dynamic = 'force-dynamic';

/** { text, dryRun?, fillEmpty?, includeNameMatches? } → per-row outcome; dryRun (default) writes nothing. */
export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 2_500_000);
    const actor = await requireCustomerActor('customers.create');
    return redactedJson(await importCustomers(sql, actor, await req.json()), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Error && /^(Dosyada|Ad ya da firma|Tek seferde)/.test(error.message)) return redactedJson({ error: error.message }, { status: 400 });
    return customerErrorResponse(error, 'Müşteri listesi aktarılamadı.');
  }
}
