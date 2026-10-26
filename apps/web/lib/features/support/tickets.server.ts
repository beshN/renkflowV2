import 'server-only';

/** In-app support tickets (support_tickets): shared by the support API and the account-closure request. */

export type SupportTicketActor = { userId: string; tenantId: string; role: string; email: string | null; name: string | null };
export type SupportTicketInput = {
  subject: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  pagePath?: string | null;
  locale?: string | null;
  metadata?: Record<string, unknown>;
};

export async function insertSupportTicket(db: any, actor: SupportTicketActor, input: SupportTicketInput) {
  const rows = await db`
    INSERT INTO support_tickets (
      tenant_id, user_id, source, status, priority, name, email, subject, message, page_path, locale, metadata, created_at, updated_at
    )
    VALUES (
      ${actor.tenantId}, ${actor.userId}, 'in_app', 'open', ${input.priority},
      ${actor.name || 'Tenant Member'}, ${actor.email || 'unknown@renkflow.local'},
      ${input.subject}, ${input.message}, ${input.pagePath || null}, ${input.locale || null},
      ${{ ...(input.metadata ?? {}), createdByRole: actor.role }},
      NOW(), NOW()
    )
    RETURNING *
  `;
  return rows[0] as Record<string, unknown>;
}
