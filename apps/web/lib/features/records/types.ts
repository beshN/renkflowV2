/** Shared (client and server) record platform types and pure helpers. */
export const RECORD_TYPES = ['order', 'quotation', 'customer', 'work_order', 'inventory_item', 'supplier', 'lead', 'installation', 'service_ticket', 'vehicle'] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export const ACTIVITY_KINDS = ['call', 'email', 'measure', 'delivery', 'production', 'feedback', 'todo'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  call: 'Ara', email: 'E-posta', measure: 'Ölçü kontrolü', delivery: 'Teslim hatırlatma', production: 'Üretim', feedback: 'Geri bildirim', todo: 'Yapılacak',
};

export const TAG_COLORS = ['slate', 'blue', 'green', 'amber', 'red', 'violet', 'teal'] as const;
export type TagColor = (typeof TAG_COLORS)[number];

/** Checklist progress as a whole percentage (0 when empty). */
export const checklistPercent = (items: Array<{ done: boolean }>) => (items.length ? Math.round((items.filter((i) => i.done).length / items.length) * 100) : 0);

/**
 * The people a comment mentions: tokens "@[Name](uuid)" written by the composer. Only ids are
 * trusted; the server checks each one is a member who may see the record.
 */
export function mentionIds(body: string): string[] {
  const ids = new Set<string>();
  for (const m of body.matchAll(/@\[[^\]\n]{1,80}\]\(([0-9a-f-]{36})\)/gi)) ids.add(m[1].toLowerCase());
  return [...ids];
}
/** The comment as people read it: "@[Ayşe](id)" shows as "@Ayşe". */
export const plainMentions = (body: string) => body.replace(/@\[([^\]\n]{1,80})\]\([0-9a-f-]{36}\)/gi, '@$1');

/** Activity state for the day: overdue, due today or later. */
export function activityState(dueOn: string, today: string, done: boolean): 'done' | 'overdue' | 'today' | 'planned' {
  if (done) return 'done';
  return dueOn < today ? 'overdue' : dueOn === today ? 'today' : 'planned';
}

/** Roles that can never open a record type (customer data stays away from workers). Mirrors the server registry. */
export const ROLES_WITHOUT_ACCESS: Record<RecordType, string[]> = {
  order: ['worker'], quotation: ['worker', 'member'], customer: ['worker'], supplier: ['worker', 'member'], work_order: [], inventory_item: [],
  // The field crew opens its own installations and tickets (the server checks the crew/assignee).
  lead: ['worker', 'member'], installation: ['member'], service_ticket: ['member'],
  // The fleet is the owner's and admins' only.
  vehicle: ['office', 'accountant', 'worker', 'member'],
};
