// SSO login tickets reuse `users.verification_token` (no migration), so the stored value must never
// look like an e-mail verification token: it is `sso:<sha256>:<expiresAtMs>:<tenantId>:<providerId>`.
// The redirect URL carries only the raw ticket, so a leaked database row or log line cannot be replayed
// as a login, a verification link never matches the `sso:` shape, and a ticket never matches
// /auth/verify's lookup. The ticket is bound to the provider's firm: the hash covers the ticket, its
// expiry, the firm and the provider, so the sign-in it allows opens a session in that firm only.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const SSO_TICKET_PREFIX = 'sso:';
/** Long enough for the redirect plus a two-step code, short enough that a leaked URL goes stale. */
export const SSO_TICKET_TTL_MS = 3 * 60_000;

export interface SsoTicketBinding {
  tenantId: string;
  providerId: string;
}

const ID = /^[0-9a-f-]{36}$/i;
const hash = (ticket: string, expiresAt: string, b: SsoTicketBinding) =>
  createHash('sha256').update(`${ticket}:${expiresAt}:${b.tenantId.toLowerCase()}:${b.providerId.toLowerCase()}`).digest('hex');

/** `ticket` goes into the redirect URL once; `stored` goes into `users.verification_token`. */
export function issueSsoTicket(binding: SsoTicketBinding, now = Date.now()) {
  if (!ID.test(binding.tenantId) || !ID.test(binding.providerId)) throw new Error('SSO ticket needs a firm and a provider');
  const ticket = randomBytes(32).toString('hex');
  const b = { tenantId: binding.tenantId.toLowerCase(), providerId: binding.providerId.toLowerCase() };
  const expiresAt = String(now + SSO_TICKET_TTL_MS);
  return { ticket, stored: `${SSO_TICKET_PREFIX}${hash(ticket, expiresAt, b)}:${expiresAt}:${b.tenantId}:${b.providerId}` };
}

export function isSsoTicketValue(stored: unknown): stored is string {
  return typeof stored === 'string' && stored.startsWith(SSO_TICKET_PREFIX);
}

/**
 * The firm and provider an unexpired ticket was issued for, or null (wrong ticket, expired, tampered,
 * or a ticket from before tickets were bound to a firm). Comparison is constant-time.
 */
export function readSsoTicket(stored: unknown, ticket: unknown, now = Date.now()): SsoTicketBinding | null {
  if (!isSsoTicketValue(stored) || typeof ticket !== 'string' || !/^[a-f0-9]{64}$/.test(ticket)) return null;
  const match = /^sso:([a-f0-9]{64}):(\d{13,}):([0-9a-f-]{36}):([0-9a-f-]{36})$/.exec(stored);
  if (!match || now > Number(match[2])) return null;
  const binding = { tenantId: match[3], providerId: match[4] };
  if (!timingSafeEqual(Buffer.from(match[1], 'hex'), Buffer.from(hash(ticket, match[2], binding), 'hex'))) return null;
  return binding;
}

export function verifySsoTicket(stored: unknown, ticket: unknown, now = Date.now()): boolean {
  return readSsoTicket(stored, ticket, now) !== null;
}
