import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { getServerUserContext } from '@/lib/features/auth/serverAuth';
import { customerErrorResponse } from '@/lib/features/customers/api';
import { ImportInput } from '@/lib/features/imports/contacts.server';
import { importSuppliers } from '@/lib/features/suppliers/import.server';
import { can } from '@/lib/security/access-matrix';
import { redactedJson } from '@/lib/security/field-access.server';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';

export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    requireSameOriginJson(request, 2_500_000);
    const actor = await getServerUserContext();
    const input = ImportInput.parse(await request.json());
    if (
      actor.narrowed &&
      (!can(actor.narrowed, 'purchasing', 'create') ||
        (input.fillEmpty && !can(actor.narrowed, 'purchasing', 'edit')))
    ) {
      throw new WorkOrderApiError('Tedarikçi aktarımı için yetkiniz yok.', 403);
    }
    return redactedJson(await importSuppliers(sql, actor, input), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return customerErrorResponse(error, 'Tedarikçi listesi aktarılamadı.');
  }
}
