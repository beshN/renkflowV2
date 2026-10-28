import 'server-only';

import { headers } from 'next/headers';
import { FIELD_GROUPS, redactFields, type FieldGroup } from './access-matrix';
import { HIDDEN_FIELDS_HEADER } from './field-header';
import { bearerToken, verifyBearerToken } from './bearer-identity';
import { narrowedHiddenFields } from './member-access.server';
import { withServerActionTiming } from '@/lib/utils/metrics';

type HeaderBag = { get(name: string): string | null };

const parseGroups = (raw: string | null | undefined) =>
  (raw ?? '').split(',').filter((f): f is FieldGroup => (FIELD_GROUPS as readonly string[]).includes(f));

/** One answer per request: next/headers hands every call in a request the same object. */
const perRequest = new WeakMap<object, Promise<FieldGroup[] | null>>();

/**
 * The field groups hidden from the person this request acts for, read from their current role:
 * the bearer token (API client, phone) and the browser session, whichever the request carries
 * (both, when it carries both: the route may act for either). Null when it carries no signed-in person.
 */
async function actorHiddenFields(h: HeaderBag): Promise<FieldGroup[] | null> {
  const actors: Array<{ userId: string; tenantId: string }> = [];
  const bearer = verifyBearerToken(bearerToken(h));
  if (bearer) actors.push(bearer);
  type SessionLike = { user?: { id?: string | null; tenantId?: string | null } } | null;
  const session: SessionLike = await import('@/auth')
    .then(({ auth }) => auth() as Promise<SessionLike>)
    .catch(() => null); // no session machinery in this context (scripts, tests)
  if (session?.user?.id && session.user.tenantId) actors.push({ userId: session.user.id, tenantId: session.user.tenantId });
  if (!actors.length) return null;
  const hidden = new Set<FieldGroup>();
  for (const a of actors) for (const g of await narrowedHiddenFields(a.userId, a.tenantId, { cached: false })) hidden.add(g);
  return FIELD_GROUPS.filter((g) => hidden.has(g));
}

/**
 * Field groups hidden from the person making this request. Derived from the resolved actor
 * (browser session, API token or phone session alike), so a narrowed role sees the same fields
 * on every path. The header the proxy sets (and always overwrites, so a client cannot send it)
 * is added on top, and is the only source when no actor can be resolved here. Empty when the
 * role does not narrow fields beyond today's checks.
 */
export async function requestHiddenFields(): Promise<FieldGroup[]> {
  let h: HeaderBag;
  try {
    h = await headers();
  } catch {
    return []; // outside a request (tests, scripts)
  }
  const fromHeader = parseGroups(h.get(HIDDEN_FIELDS_HEADER));
  let pending = perRequest.get(h as object);
  if (!pending) {
    pending = actorHiddenFields(h);
    perRequest.set(h as object, pending);
  }
  const fromActor = await pending;
  if (!fromActor) return fromHeader;
  return FIELD_GROUPS.filter((g) => fromActor.includes(g) || fromHeader.includes(g));
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
