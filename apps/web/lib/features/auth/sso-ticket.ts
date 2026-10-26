// SSO login tickets reuse `users.verification_token` (no migration), so the stored value must never
// look like an e-mail verification token: it is `sso:<sha256(ticket)>:<expiresAtMs>`. The redirect URL
// carries only the raw ticket, so a leaked database row or log line cannot be replayed as a login,
// a verification link never matches the `sso:` shape, and a ticket never matches /auth/verify's lookup.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const SSO_TICKET_PREFIX = 'sso:';
/** Long enough for the redirect plus a two-step code, short enough that a leaked URL goes stale. */
export const SSO_TICKET_TTL_MS = 3 * 60_000;

const hash = (ticket: string) => createHash('sha256').update(ticket).digest('hex');

/** `ticket` goes into the redirect URL once; `stored` goes into `users.verification_token`. */
export function issueSsoTicket(now = Date.now()) {
  const ticket = randomBytes(32).toString('hex');
  return { ticket, stored: `${SSO_TICKET_PREFIX}${hash(ticket)}:${now + SSO_TICKET_TTL_MS}` };
}

export function isSsoTicketValue(stored: unknown): stored is string {
  return typeof stored === 'string' && stored.startsWith(SSO_TICKET_PREFIX);
}

/** True only for an unexpired `sso:` value whose hash matches; comparison is constant-time. */
export function verifySsoTicket(stored: unknown, ticket: unknown, now = Date.now()): boolean {
  if (!isSsoTicketValue(stored) || typeof ticket !== 'string' || !/^[a-f0-9]{64}$/.test(ticket)) return false;
  const match = /^sso:([a-f0-9]{64}):(\d{13,})$/.exec(stored);
  if (!match || now > Number(match[2])) return false;
  return timingSafeEqual(Buffer.from(match[1], 'hex'), Buffer.from(hash(ticket), 'hex'));
}
