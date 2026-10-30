/** @jest-environment node */
import {
  assertSsoEmailTrusted,
  decideSsoLink,
  mapOidcProfile,
  mapSamlProfile,
  SSO_ERRORS,
  SsoAccessError,
  type SsoLinkFacts,
} from '@/lib/features/auth/sso-policy';

const open = { trustIdpEmail: false, domainRestrictions: [] as string[] };

describe('SSO e-mail policy (mapper)', () => {
  it('refuses an e-mail the IdP marks as unverified', () => {
    for (const verified of [false, 'false']) {
      expect(() => mapOidcProfile({ sub: 's1', email: 'kurban@firma.com', email_verified: verified }, { trustIdpEmail: true, domainRestrictions: ['firma.com'] })).toThrow(SSO_ERRORS.unverifiedEmail);
    }
    // Anything but true / "true" is not a verification.
    expect(() => mapOidcProfile({ sub: 's1', email: 'a@firma.com', email_verified: 'yes' }, { trustIdpEmail: true })).toThrow(SsoAccessError);
  });

  it('accepts a verified e-mail and normalises it', () => {
    for (const verified of [true, 'true']) {
      const profile = mapOidcProfile({ sub: 's1', email: ' Ayse@Firma.COM ', email_verified: verified, name: 'Ayşe' }, open);
      expect(profile).toMatchObject({ email: 'ayse@firma.com', subject: 's1', name: 'Ayşe' });
    }
  });

  it('with no claim, needs a provider that verifies e-mails or an allowed domain', () => {
    expect(() => mapOidcProfile({ sub: 's1', email: 'a@firma.com' }, open)).toThrow(SSO_ERRORS.unprovenEmail);
    expect(mapOidcProfile({ sub: 's1', email: 'a@firma.com' }, { trustIdpEmail: true }).email).toBe('a@firma.com');
    expect(mapOidcProfile({ sub: 's1', email: 'a@firma.com' }, { domainRestrictions: ['Firma.com'] }).email).toBe('a@firma.com');
    expect(() => mapOidcProfile({ sub: 's1', email: 'a@baska.com' }, { domainRestrictions: ['firma.com'] })).toThrow(SSO_ERRORS.domainNotAllowed);
  });

  it('applies allowed domains to verified e-mails too', () => {
    expect(() => assertSsoEmailTrusted('a@baska.com', true, { domainRestrictions: ['firma.com'] })).toThrow(SSO_ERRORS.domainNotAllowed);
  });

  it('takes the claim from the ID token only when userinfo leaves it out for the same address', () => {
    expect(mapOidcProfile({ sub: 's1', email: 'a@firma.com' }, open, { sub: 's1', email: 'a@firma.com', email_verified: true }).email).toBe('a@firma.com');
    expect(() => mapOidcProfile({ sub: 's1', email: 'a@firma.com' }, open, { sub: 's1', email: 'b@firma.com', email_verified: true })).toThrow(SSO_ERRORS.unprovenEmail);
    expect(() => mapOidcProfile({ sub: 's1', email: 'a@firma.com', email_verified: false }, open, { email: 'a@firma.com', email_verified: true })).toThrow(SSO_ERRORS.unverifiedEmail);
  });

  it('needs an e-mail and a subject', () => {
    expect(() => mapOidcProfile({ sub: 's1', email_verified: true }, open)).toThrow(SSO_ERRORS.missingEmail);
    expect(() => mapOidcProfile({ email: 'a@firma.com', email_verified: true }, open)).toThrow(SSO_ERRORS.missingSubject);
    expect(mapOidcProfile({ email: 'a@firma.com', email_verified: true }, open, { sub: 'from-id-token' }).subject).toBe('from-id-token');
  });

  it('treats SAML (no verified flag) by provider policy and uses NameID as subject', () => {
    expect(() => mapSamlProfile({ nameID: 'n1', email: 'a@firma.com' }, open)).toThrow(SSO_ERRORS.unprovenEmail);
    expect(mapSamlProfile({ nameID: 'n1', email: 'a@firma.com' }, { trustIdpEmail: true })).toMatchObject({ subject: 'n1', email: 'a@firma.com' });
    expect(mapSamlProfile({ nameID: 'n1', email: 'a@firma.com', memberOf: 'CN=Non-Admin,OU=Users' }, { trustIdpEmail: true }).groups).toEqual(['CN=Non-Admin,OU=Users']);
    expect(() => mapSamlProfile({ email: 'a@firma.com' }, { trustIdpEmail: true })).toThrow(SSO_ERRORS.missingSubject);
  });
});

describe('SSO identity binding', () => {
  const base: SsoLinkFacts = {
    identitiesAvailable: true,
    identityUserId: null,
    emailUserId: null,
    emailUserSubject: null,
    subject: 'sub-1',
    allowSignup: false,
    membership: 'none',
  };
  const refused = (facts: Partial<SsoLinkFacts>) => {
    try {
      decideSsoLink({ ...base, ...facts });
    } catch (error) {
      expect(error).toBeInstanceOf(SsoAccessError);
      return (error as Error).message;
    }
    throw new Error('expected a refusal');
  };

  it('a known (provider, subject) is that user, whatever e-mail comes with it', () => {
    expect(decideSsoLink({ ...base, identityUserId: 'u1', membership: 'active' })).toEqual({ kind: 'identity', userId: 'u1', addMembership: false });
  });

  it('a known subject without membership re-joins only with sign-up allowed', () => {
    expect(refused({ identityUserId: 'u1' })).toBe(SSO_ERRORS.notMember);
    expect(decideSsoLink({ ...base, identityUserId: 'u1', allowSignup: true })).toEqual({ kind: 'identity', userId: 'u1', addMembership: true });
  });

  it('links an existing account that is a member of the provider firm', () => {
    expect(decideSsoLink({ ...base, emailUserId: 'u1', membership: 'active' })).toEqual({ kind: 'link', userId: 'u1', addMembership: false, recordIdentity: true });
  });

  it('does not link an account from another firm unless sign-up provisions it here', () => {
    expect(refused({ emailUserId: 'u1' })).toBe(SSO_ERRORS.notMember);
    expect(decideSsoLink({ ...base, emailUserId: 'u1', allowSignup: true })).toEqual({ kind: 'link', userId: 'u1', addMembership: true, recordIdentity: true });
  });

  it('refuses a different subject claiming an e-mail already linked on this provider', () => {
    expect(refused({ emailUserId: 'u1', emailUserSubject: 'sub-0', membership: 'active', allowSignup: true })).toBe(SSO_ERRORS.subjectTaken);
  });

  it('refuses a deactivated member', () => {
    expect(refused({ identityUserId: 'u1', membership: 'deactivated', allowSignup: true })).toBe(SSO_ERRORS.deactivated);
    expect(refused({ emailUserId: 'u1', membership: 'deactivated', allowSignup: true })).toBe(SSO_ERRORS.deactivated);
  });

  it('creates an account only with sign-up allowed', () => {
    expect(refused({})).toBe(SSO_ERRORS.signupDisabled);
    expect(decideSsoLink({ ...base, allowSignup: true })).toEqual({ kind: 'create', recordIdentity: true });
  });

  it('without the identity table: only existing members, nothing recorded', () => {
    const legacy = { ...base, identitiesAvailable: false };
    expect(decideSsoLink({ ...legacy, emailUserId: 'u1', membership: 'active' })).toEqual({ kind: 'link', userId: 'u1', addMembership: false, recordIdentity: false });
    expect(refused({ ...legacy, emailUserId: 'u1', allowSignup: true })).toBe(SSO_ERRORS.notMember);
    expect(decideSsoLink({ ...legacy, allowSignup: true })).toEqual({ kind: 'create', recordIdentity: false });
  });
});
