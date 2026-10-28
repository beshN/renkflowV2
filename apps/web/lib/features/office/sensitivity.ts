/**
 * What an AI office task's brief, summary and delivered files may contain, and who may see them.
 * A delivery is raw text or an Office file, so the field hiding of JSON responses cannot clean it
 * afterwards: the task carries markers instead, written when it is created and while it works,
 * and the list and file download show it only to people cleared for every marker. Pure.
 *
 * - 'finance': finance work (spreadsheets and data work run on the finance desk) or firm finance
 *   data (prices, costs, profit, payroll) in the brief or in the records it looked up.
 * - 'price' | 'cost' | 'profit' | 'customer_contact': those kinds of fields were in the records
 *   the task giver's lookups returned (the giver could see them; others may not).
 *
 * The giver and the firm's owners and admins always see the task. Others need a role that hides
 * none of the marked kinds of fields ('finance' means price, cost and profit). A task whose
 * markers are not known (before migration 079, or the column missing) counts as carrying all.
 */
import { FIELD_GROUPS, FIELD_KEYS, type FieldGroup } from '@/lib/security/access-matrix';

export const OFFICE_SENSITIVITY = ['finance', ...FIELD_GROUPS] as const;
export type OfficeSensitivity = (typeof OFFICE_SENSITIVITY)[number];

const FINANCE_CATEGORIES = new Set(['spreadsheet', 'data']);
/** Record kinds the office looks up that are finance data by themselves (payroll). */
const FINANCE_LOOKUPS = new Set(['employees']);
const FINANCE_WORDS = /fiyat|maliyet|kâr|kar marj|marj|ciro|gelir|gider|bütçe|butce|finans|mali |muhasebe|fatura|tahsilat|ödeme|odeme|bakiye|borç|borc|alacak|maaş|maas|bordro|nakit|kdv|vergi|bilanço|bilanco|price|cost|profit|revenue|invoice|payroll/i;

const sort = (set: Set<string>) => OFFICE_SENSITIVITY.filter((s) => set.has(s));

/** Markers a new task gets from its kind of work and the words of its brief. */
export function briefSensitivity(category: string, text: string): OfficeSensitivity[] {
  const out = new Set<string>();
  if (FINANCE_CATEGORIES.has(category) || FINANCE_WORDS.test(text)) out.add('finance');
  return sort(out);
}

const KEY_GROUP = new Map<string, FieldGroup>(FIELD_GROUPS.flatMap((g) => FIELD_KEYS[g].map((k) => [k, g] as [string, FieldGroup])));
/** The same key patterns the assistant's own field hiding uses (assistant-records.server.ts). */
const KEY_PATTERNS: Array<[RegExp, FieldGroup]> = [
  [/(price|amount|subtotal|discount|tax_amount|collected|ordered_value|revenue)/i, 'price'],
  [/cost/i, 'cost'],
  [/profit|margin/i, 'profit'],
  [/phone|email|address|contact/i, 'customer_contact'],
];

/** Markers for the records a lookup returned: the kinds of fields present with a value. */
export function foundSensitivity(category: string, found: unknown): OfficeSensitivity[] {
  const out = new Set<string>();
  if (FINANCE_LOOKUPS.has(category)) out.add('finance');
  const walk = (v: unknown, depth: number) => {
    if (depth > 12 || v === null || typeof v !== 'object') return;
    if (Array.isArray(v)) return v.forEach((x) => walk(x, depth + 1));
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (x !== null && x !== undefined && x !== '') {
        const group = KEY_GROUP.get(k) ?? KEY_PATTERNS.find(([re]) => re.test(k))?.[1];
        // "total" next to a list is a count, not money.
        if (group && !(k === 'total' && typeof x === 'number' && Number.isInteger(x))) out.add(group);
      }
      walk(x, depth + 1);
    }
  };
  walk(found, 0);
  if (out.has('price') || out.has('cost') || out.has('profit')) out.add('finance');
  return sort(out);
}

export function mergeSensitivity(...lists: Array<readonly string[] | null | undefined>): OfficeSensitivity[] {
  return sort(new Set(lists.flatMap((l) => l ?? [])));
}

/** Whether this person may see a task (its brief, summary and files). */
export function officeTaskVisible(
  viewer: { userId: string; role: string; hidden: readonly FieldGroup[] },
  task: { createdBy: string; sensitivity: readonly string[] | null | undefined },
): boolean {
  if (task.createdBy === viewer.userId || viewer.role === 'owner' || viewer.role === 'admin') return true;
  const markers = Array.isArray(task.sensitivity) ? task.sensitivity : OFFICE_SENSITIVITY;
  return markers.every((m) => {
    if (m === 'finance') return !viewer.hidden.some((h) => h === 'price' || h === 'cost' || h === 'profit');
    if ((FIELD_GROUPS as readonly string[]).includes(m)) return !viewer.hidden.includes(m as FieldGroup);
    return viewer.hidden.length === 0; // a marker this code does not know: only roles that hide nothing
  });
}
