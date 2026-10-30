// Rules for turning an identity provider's answer into a RenkFlow account. Pure (no database), so the
// decisions are unit-tested on their own; lib/features/auth/sso.ts runs them inside the transaction.

/** A refusal the person may see: the callback answers 403 with this Turkish message. */
export class SsoAccessError extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = 'SsoAccessError';
  }
}

export interface SsoEmailPolicy {
  /** The provider was set up as one whose e-mail addresses are verified by the IdP itself. */
  trustIdpEmail?: boolean;
  domainRestrictions?: string[];
}

export interface SsoProfile {
  email: string;
  /** The IdP's stable id for the person: OIDC `sub`, SAML NameID. */
  subject: string;
  name?: string;
  surname?: string;
  groups?: string[];
  attributes?: Record<string, unknown>;
}

export const SSO_ERRORS = {
  missingEmail: 'Kimlik sağlayıcısı e-posta adresi göndermedi.',
  missingSubject: 'Kimlik sağlayıcısı kullanıcı kimliği (subject) göndermedi.',
  unverifiedEmail: 'Kimlik sağlayıcısı bu e-posta adresini doğrulanmamış olarak bildirdi; SSO ile giriş yapılamaz.',
  unprovenEmail:
    'Kimlik sağlayıcısı e-posta adresinin doğrulandığını bildirmedi. Yöneticiniz bu sağlayıcıyı doğrulanmış e-posta gönderen sağlayıcı olarak işaretlemeli veya izinli e-posta alan adlarını tanımlamalıdır.',
  domainNotAllowed: 'Bu e-posta alan adı bu SSO sağlayıcısı için izinli değil.',
  subjectTaken: 'Bu e-posta adresi bu SSO sağlayıcısında başka bir kullanıcı kimliğine bağlı.',
  notMember: 'Bu hesap SSO sağlayıcısının bağlı olduğu şirkete üye değil.',
  deactivated: 'Bu şirketteki üyeliğiniz devre dışı bırakılmış.',
  signupDisabled: 'Bu SSO sağlayıcısı için otomatik hesap açma kapalı.',
} as const;

export function normalizeSsoEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf('@') + 1);
}

function allowedDomains(policy: SsoEmailPolicy): string[] {
  return (policy.domainRestrictions ?? []).map((d) => String(d).trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
}

/**
 * Whether the e-mail can be used to find or create an account.
 * - The provider's `email_verified` must be true when present; false (or anything else) is refused.
 * - When absent (SAML never has it, some OIDC IdPs omit it), the provider must be marked as verifying
 *   e-mails itself, or the address must be in one of its allowed domains.
 * - Allowed domains, when set, always apply.
 */
export function assertSsoEmailTrusted(email: string, emailVerified: unknown, policy: SsoEmailPolicy): void {
  if (!email || !email.includes('@')) throw new SsoAccessError(SSO_ERRORS.missingEmail);
  const domains = allowedDomains(policy);
  const domainAllowed = domains.includes(emailDomain(email));
  if (domains.length && !domainAllowed) throw new SsoAccessError(SSO_ERRORS.domainNotAllowed);
  if (emailVerified === undefined || emailVerified === null) {
    if (policy.trustIdpEmail === true || domainAllowed) return;
    throw new SsoAccessError(SSO_ERRORS.unprovenEmail);
  }
  if (emailVerified === true || emailVerified === 'true') return;
  throw new SsoAccessError(SSO_ERRORS.unverifiedEmail);
}

/** OIDC userinfo (with the ID token's subject as a fallback) to a profile; refuses untrusted e-mails. */
export function mapOidcProfile(
  userInfo: Record<string, unknown>,
  policy: SsoEmailPolicy,
  idTokenClaims?: Record<string, unknown>,
): SsoProfile {
  const email = normalizeSsoEmail(userInfo.email);
  const subject = String(userInfo.sub ?? idTokenClaims?.sub ?? '').trim();
  if (!email) throw new SsoAccessError(SSO_ERRORS.missingEmail);
  if (!subject) throw new SsoAccessError(SSO_ERRORS.missingSubject);
  // userinfo wins; the ID token's claim counts when userinfo leaves it out.
  const verified = userInfo.email_verified ?? (normalizeSsoEmail(idTokenClaims?.email) === email ? idTokenClaims?.email_verified : undefined);
  assertSsoEmailTrusted(email, verified, policy);
  const name = typeof userInfo.name === 'string' ? userInfo.name : typeof userInfo.given_name === 'string' ? userInfo.given_name : undefined;
  return {
    email,
    subject,
    name,
    surname: typeof userInfo.family_name === 'string' ? userInfo.family_name : undefined,
    groups: Array.isArray(userInfo.groups) ? userInfo.groups.map(String) : undefined,
    attributes: userInfo,
  };
}

/** A validated SAML assertion profile; there is no verified flag, so the provider policy decides. */
export function mapSamlProfile(profile: Record<string, any> | null | undefined, policy: SsoEmailPolicy): SsoProfile {
  const email = normalizeSsoEmail(
    profile?.email || profile?.mail || profile?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
  );
  if (!email) throw new SsoAccessError(SSO_ERRORS.missingEmail);
  const subject = String(profile?.nameID ?? '').trim();
  if (!subject) throw new SsoAccessError(SSO_ERRORS.missingSubject);
  assertSsoEmailTrusted(email, undefined, policy);
  return {
    email,
    subject,
    name: profile?.givenName || profile?.firstName || profile?.name,
    surname: profile?.sn || profile?.lastName || profile?.surname,
    groups: Array.isArray(profile?.groups ?? profile?.memberOf) ? (profile?.groups ?? profile?.memberOf).map((g: unknown) => String(g).trim()).filter(Boolean) : typeof (profile?.groups ?? profile?.memberOf) === 'string' && String(profile?.groups ?? profile?.memberOf).trim() ? [String(profile?.groups ?? profile?.memberOf).trim()] : undefined,
    attributes: profile ?? {},
  };
}

export interface SsoLinkFacts {
  /** `sso_identities` exists (migration 080). Without it nothing is linked and only members get in. */
  identitiesAvailable: boolean;
  /** The user already bound to this (provider, subject). */
  identityUserId: string | null;
  /** The account with the profile's e-mail. */
  emailUserId: string | null;
  /** The subject this provider already bound to that account, if any. */
  emailUserSubject: string | null;
  subject: string;
  allowSignup: boolean;
  /** Membership of the account that would be used, in the provider's firm. */
  membership: 'active' | 'deactivated' | 'none';
}

export type SsoLinkDecision =
  /** Known (provider, subject). */
  | { kind: 'identity'; userId: string; addMembership: boolean }
  /** Existing account with that e-mail, bound now. */
  | { kind: 'link'; userId: string; addMembership: boolean; recordIdentity: boolean }
  /** No account with that e-mail: create it in the provider's firm. */
  | { kind: 'create'; recordIdentity: boolean };

/**
 * Which account a provider login belongs to. An e-mail only finds an existing account when the
 * subject is new to this provider, the account has no other subject here, and the account is (or,
 * with sign-up allowed, becomes) a member of the provider's firm; without the identity table, only
 * an existing member.
 */
export function decideSsoLink(f: SsoLinkFacts): SsoLinkDecision {
  if (f.membership === 'deactivated') throw new SsoAccessError(SSO_ERRORS.deactivated);
  const missing = f.membership === 'none';
  if (f.identitiesAvailable && f.identityUserId) {
    if (missing && !f.allowSignup) throw new SsoAccessError(SSO_ERRORS.notMember);
    return { kind: 'identity', userId: f.identityUserId, addMembership: missing };
  }
  if (f.emailUserId) {
    if (f.identitiesAvailable && f.emailUserSubject && f.emailUserSubject !== f.subject) {
      throw new SsoAccessError(SSO_ERRORS.subjectTaken);
    }
    if (missing && (!f.allowSignup || !f.identitiesAvailable)) throw new SsoAccessError(SSO_ERRORS.notMember);
    return { kind: 'link', userId: f.emailUserId, addMembership: missing, recordIdentity: f.identitiesAvailable };
  }
  if (!f.allowSignup) throw new SsoAccessError(SSO_ERRORS.signupDisabled);
  return { kind: 'create', recordIdentity: f.identitiesAvailable };
}
