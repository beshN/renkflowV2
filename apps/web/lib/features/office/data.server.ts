import 'server-only';

import { sql } from '@/lib/db';
import { columnExists } from '@/lib/db/schema-guard';
import { ASSISTANT_SEARCH_CATEGORIES } from '@/lib/ai/assistant-context';
import { hideAssistantFields, searchAssistantRecords } from '@/lib/ai/assistant-records.server';
import { searchAssistant } from '@/lib/ai/workspace';
import { ROUTE_ROLES } from '@/lib/features/auth/permissions';
import { resolveMemberAccess } from '@/lib/security/member-access.server';
import type { WorkOrderActor } from '@/lib/features/work-orders/security';

/**
 * What the AI office may read of the firm while it works: its own details for letterheads and
 * signatures, and the records the person who gave the task could look up themselves (the
 * assistant's searches, with that person's role, custom role and hidden fields). Nothing is
 * written.
 */

/** The person who gave the task, as they are now: a removed or demoted member's tasks read nothing. */
export async function taskActor(tenantId: string, userId: string): Promise<WorkOrderActor | null> {
  const access = await resolveMemberAccess(userId, tenantId);
  if (!access || access.deactivated || !ROUTE_ROLES['/office'].includes(access.base)) return null;
  return { tenantId, userId, role: access.base, access };
}

/** These kinds are searched the way the assistant chat searches them; the rest through its record search. */
const CHAT_SEARCHES = new Set(['orders', 'customers', 'materials', 'jobs']);

export async function lookUpRecords(actor: WorkOrderActor | null, category: string, query: string): Promise<unknown> {
  if (!actor) return { scope: 'Görevi veren kişinin firma kayıtlarına erişimi yok.' };
  if (!(ASSISTANT_SEARCH_CATEGORIES as readonly string[]).includes(category)) return { scope: 'Bilinmeyen kayıt türü.' };
  const found = CHAT_SEARCHES.has(category) ? await searchAssistant(actor, category, query) : await searchAssistantRecords(actor, category, query);
  return hideAssistantFields(found, actor.access?.hidden ?? []);
}

/**
 * Adds markers to a task (sensitivity.ts) before anything it produced from them is stored. A task
 * whose markers are not known (null) stays that way: unknown counts as the most sensitive. Before
 * migration 079 there is nothing to write and every task reads as unknown.
 */
export async function markTaskSensitivity(tenantId: string, taskId: string, markers: readonly string[]) {
  if (!markers.length || !(await columnExists('office_tasks', 'sensitivity'))) return;
  await sql`UPDATE office_tasks SET sensitivity = ARRAY(SELECT DISTINCT m FROM unnest(sensitivity || ${[...markers]}::text[]) AS m ORDER BY m)
    WHERE tenant_id=${tenantId} AND id=${taskId} AND sensitivity IS NOT NULL`;
}

/** The firm's own name, legal details and contact, only the fields it has filled in. */
export async function companyProfile(tenantId: string): Promise<Record<string, string> | null> {
  const [row] = await sql`SELECT name, legal_name, industry, tax_office, tax_number, mersis_no, address_line, district, city, postal_code, phone, invoice_email, brand_color
    FROM tenants WHERE id=${tenantId}`;
  if (!row) return null;
  return Object.fromEntries(Object.entries(row).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, (v as string).trim()]));
}
