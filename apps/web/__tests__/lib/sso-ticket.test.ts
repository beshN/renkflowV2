/** @jest-environment node */
import {
  issueSsoTicket,
  isSsoTicketValue,
  SSO_TICKET_TTL_MS,
  verifySsoTicket,
} from '@/lib/features/auth/sso-ticket';

describe('sso ticket', () => {
  const now = 1_760_000_000_000;

  it('accepts its own ticket until it expires', () => {
    const { ticket, stored } = issueSsoTicket(now);
    expect(verifySsoTicket(stored, ticket, now)).toBe(true);
    expect(verifySsoTicket(stored, ticket, now + SSO_TICKET_TTL_MS)).toBe(true);
    expect(verifySsoTicket(stored, ticket, now + SSO_TICKET_TTL_MS + 1)).toBe(false);
  });

  it('keeps only a hash in the database value', () => {
    const { ticket, stored } = issueSsoTicket(now);
    expect(stored.startsWith('sso:')).toBe(true);
    expect(stored).not.toContain(ticket);
    expect(isSsoTicketValue(stored)).toBe(true);
  });

  it('rejects another ticket, a tampered expiry and malformed input', () => {
    const { ticket, stored } = issueSsoTicket(now);
    const other = issueSsoTicket(now).ticket;
    expect(verifySsoTicket(stored, other, now)).toBe(false);
    const extended = stored.replace(/:\d+$/, `:${now + 10 * SSO_TICKET_TTL_MS}`);
    expect(verifySsoTicket(extended, other, now + 5 * SSO_TICKET_TTL_MS)).toBe(false);
    expect(verifySsoTicket(stored, ticket.toUpperCase(), now)).toBe(false);
    expect(verifySsoTicket(stored, undefined, now)).toBe(false);
    expect(verifySsoTicket(null, ticket, now)).toBe(false);
    expect(verifySsoTicket('sso:abc:1', ticket, 0)).toBe(false);
  });

  it('never treats an e-mail verification token as a ticket, or the reverse', () => {
    const verificationToken = 'a'.repeat(64);
    expect(isSsoTicketValue(verificationToken)).toBe(false);
    expect(verifySsoTicket(verificationToken, verificationToken, now)).toBe(false);
    const { ticket, stored } = issueSsoTicket(now);
    // /auth/verify looks rows up by the raw token; the row holds `sso:<hash>:<expiry>`, never the ticket.
    expect(stored).not.toBe(ticket);
    expect(/^[a-f0-9]{64}$/i.test(stored)).toBe(false);
  });
});
