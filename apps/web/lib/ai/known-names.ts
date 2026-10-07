import 'server-only';

import { sql } from '@/lib/db';

/**
 * The firm's customer, supplier and member names, so they are masked wherever they appear in a
 * prompt, including chat history that already holds names restored in earlier turns.
 */
export async function tenantPersonalNames(tenantId: string): Promise<string[]> {
  const rows = await sql`
    (SELECT full_name AS value FROM customers WHERE tenant_id = ${tenantId} AND full_name IS NOT NULL LIMIT 5000)
    UNION (SELECT company_name FROM customers WHERE tenant_id = ${tenantId} AND company_name IS NOT NULL LIMIT 5000)
    UNION (SELECT contact_name FROM suppliers WHERE tenant_id = ${tenantId} AND contact_name IS NOT NULL LIMIT 2000)
    UNION (SELECT name FROM suppliers WHERE tenant_id = ${tenantId} AND name IS NOT NULL LIMIT 2000)
    UNION (SELECT u.name FROM tenant_members m JOIN users u ON u.id = m.user_id WHERE m.tenant_id = ${tenantId} AND u.name IS NOT NULL LIMIT 2000)
  `;
  return rows.map((row: any) => String(row.value)).filter((value: string) => value.trim().length >= 3);
}
