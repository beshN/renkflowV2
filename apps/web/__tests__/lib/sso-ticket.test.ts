/** @jest-environment node */
import {
  issueSsoTicket,
  isSsoTicketValue,
  readSsoTicket,
  SSO_TICKET_TTL_MS,
  verifySsoTicket,
} from '@/lib/features/auth/sso-ticket';

describe('sso ticket', () => {
  const now = 1_760_000_000_000;
  const binding = { tenantId: '11111111-1111-4111-8111-111111111111', providerId: '22222222-2222-4222-8222-222222222222' };
  const otherTenant = '33333333-3333-4333-8333-333333333333';

  it('accepts its own ticket until it expires', () => {
    const { ticket, stored } = issueSsoTicket(binding, now);
    expect(verifySsoTicket(stored, ticket, now)).toBe(true);
    expect(verifySsoTicket(stored, ticket, now + SSO_TICKET_TTL_MS)).toBe(true);
    expect(verifySsoTicket(stored, ticket, now + SSO_TICKET_TTL_MS + 1)).toBe(false);
  });

  it('keeps only a hash in the database value', () => {
    const { ticket, stored } = issueSsoTicket(binding, now);
    expect(stored.startsWith('sso:')).toBe(true);
    expect(stored).not.toContain(ticket);
    expect(isSsoTicketValue(stored)).toBe(true);
  });

  it('carries the provider firm and provider it was issued for', () => {
    const { ticket, stored } = issueSsoTicket(binding, now);
    expect(readSsoTicket(stored, ticket, now)).toEqual(binding);
  });

  it('refuses a ticket whose firm or provider was changed in the row', () => {
    const { ticket, stored } = issueSsoTicket(binding, now);
    expect(readSsoTicket(stored.replace(binding.tenantId, otherTenant), ticket, now)).toBeNull();
    expect(readSsoTicket(stored.replace(binding.providerId, otherTenant), ticket, now)).toBeNull();
  });

  it('refuses a ticket from before tickets were bound to a firm', () => {
    const { ticket, stored } = issueSsoTicket(binding, now);
    const legacy = stored.split(':').slice(0, 3).join(':');
    expect(readSsoTicket(legacy, ticket, now)).toBeNull();
  });

  it('cannot be issued without a firm and a provider', () => {
    expect(() => issueSsoTicket({ tenantId: '', providerId: binding.providerId }, now)).toThrow();
    expect(() => issueSsoTicket({ tenantId: binding.tenantId, providerId: 'x' }, now)).toThrow();
  });

  it('rejects another ticket, a tampered expiry and malformed input', () => {
    const { ticket, stored } = issueSsoTicket(binding, now);
    const other = issueSsoTicket(binding, now).ticket;
    expect(verifySsoTicket(stored, other, now)).toBe(false);
    const extended = stored.replace(/:(\d{13,}):/, `:${now + 10 * SSO_TICKET_TTL_MS}:`);
    expect(verifySsoTicket(extended, other, now + 5 * SSO_TICKET_TTL_MS)).toBe(false);
    expect(verifySsoTicket(extended, ticket, now + 5 * SSO_TICKET_TTL_MS)).toBe(false);
    expect(verifySsoTicket(stored, ticket.toUpperCase(), now)).toBe(false);
    expect(verifySsoTicket(stored, undefined, now)).toBe(false);
    expect(verifySsoTicket(null, ticket, now)).toBe(false);
    expect(verifySsoTicket('sso:abc:1', ticket, 0)).toBe(false);
  });

  it('never treats an e-mail verification token as a ticket, or the reverse', () => {
    const verificationToken = 'a'.repeat(64);
    expect(isSsoTicketValue(verificationToken)).toBe(false);
    expect(verifySsoTicket(verificationToken, verificationToken, now)).toBe(false);
    const { ticket, stored } = issueSsoTicket(binding, now);
    // /auth/verify looks rows up by the raw token; the row holds `sso:<hash>:...`, never the ticket.
    expect(stored).not.toBe(ticket);
    expect(/^[a-f0-9]{64}$/i.test(stored)).toBe(false);
  });
});
