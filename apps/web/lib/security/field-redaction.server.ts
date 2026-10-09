import 'server-only';

import { headers } from 'next/headers';
import { FIELD_GROUPS, redactFields, type FieldGroup } from './access-matrix';
import { HIDDEN_FIELDS_HEADER } from './field-header';
import { withServerActionTiming } from '@/lib/utils/metrics';

/**
 * Field groups hidden from the person making this request. The proxy resolves the member's role
 * and passes them in a header it always overwrites (a client cannot send it); empty when the role
 * does not narrow fields beyond today's checks.
 */
export async function requestHiddenFields(): Promise<FieldGroup[]> {
  try {
    const raw = (await headers()).get(HIDDEN_FIELDS_HEADER) ?? '';
    return raw.split(',').filter((f): f is FieldGroup => (FIELD_GROUPS as readonly string[]).includes(f));
  } catch {
    return []; // outside a request (tests, scripts)
  }
}

/** The data without the fields this request may not see. */
export async function redactForRequest<T>(data: T): Promise<T> {
  return redactFields(data, await requestHiddenFields());
}

/** Refuse a file download that would carry a hidden kind of field (CSV with prices, etc.). */
export async function hidesAny(groups: FieldGroup[]) {
  const hidden = await requestHiddenFields();
  return groups.some((g) => hidden.includes(g));
}

/** A server action's timed run whose result drops the fields this request may not see. */
export async function redactedAction<T>(actionName: string, fn: () => Promise<T>): Promise<T> {
  return redactForRequest(await withServerActionTiming(actionName, fn));
}
